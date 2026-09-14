import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SteamPlayerUnlocksService } from "../achievements/player-unlocks.service";

// Inputs to the transition state machine. `openSession` is the currently
// open row in the DB (if any); `previous` is the prior player-state row
// before this tick's upsert (carries `lastPolledAt` used as the close
// timestamp); `next` is the just-fetched Steam state.
export interface TransitionInput {
  openSession: { id: string; appid: number } | null;
  previous: { appid: number | null; lastPolledAt: Date } | null;
  next: { appid: number | null; gameName: string | null };
  now: Date;
}

/**
 * A gap between two ticks longer than this ends the open session at the
 * last tick that saw it, even when the same game is showing again now. The
 * poller runs every two minutes, so this is seven missed ticks — well past a
 * restart, well short of an evening. Without it the api sleeping overnight
 * with the game open on both sides stitched two evenings into one 29-hour
 * row (Mortal Shell II, 2026-08-18 → 20; the playtime snapshots for those
 * days sum to under eleven hours). Splitting a real sitting across a long
 * outage is the honest failure: the middle was not observed either way.
 */
export const SESSION_POLL_GAP_MAX_MS = 15 * 60 * 1000;

export type TransitionAction =
  | { type: "noop" }
  | { type: "open"; appid: number; name: string }
  | { type: "close"; openId: string; closedAppid: number; endedAt: Date }
  | {
      type: "closeAndOpen";
      openId: string;
      closedAppid: number;
      endedAt: Date;
      openAppid: number;
      name: string;
    };

// Pure function — no Prisma, no clock. Decides what session writes (if
// any) the current tick should produce. Split out so the state machine
// can be tested without DB mocks (same pattern as `diffOwnedGames`).
//
// The DB's open-session row is the source of truth, not the prior
// player-state row — that way an orphan session (e.g. left open by a
// pre-Chunk-3 deploy, or a desync bug) still converges on the next tick.
// Previous player-state is only used to anchor `endedAt` on a meaningful
// "last seen" timestamp.
export function computeTransition(input: TransitionInput): TransitionAction {
  const { openSession, previous, next, now } = input;
  const targetAppid = next.appid;

  // The endedAt anchor: previous lastPolledAt is the last moment we
  // observed the owner still in the game we're closing. Only honoured
  // when the open session matches the previous state — for orphan
  // sessions (open row's appid doesn't match prior player-state), fall
  // back to `now` since we have no better signal.
  const closeEndedAt =
    previous !== null && openSession !== null && openSession.appid === previous.appid
      ? previous.lastPolledAt
      : now;

  if (openSession === null) {
    if (targetAppid === null) return { type: "noop" };
    return {
      type: "open",
      appid: targetAppid,
      name: next.gameName ?? `App ${targetAppid}`,
    };
  }

  if (openSession.appid === targetAppid) {
    const unobservedFor =
      previous !== null && openSession.appid === previous.appid
        ? now.getTime() - previous.lastPolledAt.getTime()
        : 0;
    if (unobservedFor <= SESSION_POLL_GAP_MAX_MS) return { type: "noop" };
    // Same game after a long silence: whatever ran in between is unknown,
    // so the row that was open ends where observation did, and this tick
    // opens a fresh one.
    return {
      type: "closeAndOpen",
      openId: openSession.id,
      closedAppid: openSession.appid,
      endedAt: closeEndedAt,
      openAppid: targetAppid,
      name: next.gameName ?? `App ${targetAppid}`,
    };
  }

  if (targetAppid === null) {
    return {
      type: "close",
      openId: openSession.id,
      closedAppid: openSession.appid,
      endedAt: closeEndedAt,
    };
  }

  return {
    type: "closeAndOpen",
    openId: openSession.id,
    closedAppid: openSession.appid,
    endedAt: closeEndedAt,
    openAppid: targetAppid,
    name: next.gameName ?? `App ${targetAppid}`,
  };
}

@Injectable()
export class SteamPlaySessionsService {
  private readonly logger = new Logger(SteamPlaySessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly playerUnlocks: SteamPlayerUnlocksService
  ) {}

  // Called once per player-state tick after the upsert. Looks up the
  // currently-open session, computes the action via `computeTransition`,
  // and applies it. Logged transitions are useful breadcrumbs when
  // debugging chunk 4's event-driven unlock refresh.
  async recordTransition(args: {
    previous: { appid: number | null; lastPolledAt: Date } | null;
    next: { appid: number | null; gameName: string | null };
  }): Promise<void> {
    const openSession = await this.prisma.steamPlaySession.findFirst({
      where: { endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true, appid: true },
    });

    const action = computeTransition({
      openSession,
      previous: args.previous,
      next: args.next,
      now: new Date(),
    });

    switch (action.type) {
      case "noop":
        return;
      case "open":
        await this.prisma.steamPlaySession.create({
          data: { appid: action.appid, gameNameSnapshot: action.name },
        });
        this.logger.log(`session open: appid=${action.appid} (${action.name})`);
        return;
      case "close":
        await this.prisma.steamPlaySession.update({
          where: { id: action.openId },
          data: { endedAt: action.endedAt },
        });
        this.logger.log(`session close: id=${action.openId}`);
        this.fireUnlockRefresh(action.closedAppid);
        return;
      case "closeAndOpen":
        await this.prisma.$transaction([
          this.prisma.steamPlaySession.update({
            where: { id: action.openId },
            data: { endedAt: action.endedAt },
          }),
          this.prisma.steamPlaySession.create({
            data: { appid: action.openAppid, gameNameSnapshot: action.name },
          }),
        ]);
        this.logger.log(
          `session switch: closed id=${action.openId}, opened appid=${action.openAppid} (${action.name})`
        );
        this.fireUnlockRefresh(action.closedAppid);
        return;
    }
  }

  // Fire-and-forget the per-game unlock refresh on session close. Decoupled
  // from the player-state tick on purpose: a slow `GetPlayerAchievements`
  // call (or the limiter being saturated) shouldn't delay the next tick or
  // wedge the anti-overlap guard upstream. If this drops on the floor,
  // the 4-hour backstop and the hourly recently-played poller both reconcile.
  private fireUnlockRefresh(appid: number): void {
    this.playerUnlocks.refreshUnlocksForGame(appid).catch((err) => {
      this.logger.warn(`unlock refresh for closed session appid=${appid} failed: ${err}`);
    });
  }
}
