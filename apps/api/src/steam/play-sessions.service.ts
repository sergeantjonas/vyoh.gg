import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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

export type TransitionAction =
  | { type: "noop" }
  | { type: "open"; appid: number; name: string }
  | { type: "close"; openId: string; endedAt: Date }
  | {
      type: "closeAndOpen";
      openId: string;
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

  if (openSession.appid === targetAppid) return { type: "noop" };

  if (targetAppid === null) {
    return { type: "close", openId: openSession.id, endedAt: closeEndedAt };
  }

  return {
    type: "closeAndOpen",
    openId: openSession.id,
    endedAt: closeEndedAt,
    openAppid: targetAppid,
    name: next.gameName ?? `App ${targetAppid}`,
  };
}

@Injectable()
export class SteamPlaySessionsService {
  private readonly logger = new Logger(SteamPlaySessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        return;
    }
  }
}
