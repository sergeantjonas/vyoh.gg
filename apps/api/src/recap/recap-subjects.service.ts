import { Injectable } from "@nestjs/common";
import type { RecapCandidate, RecapChapterDescriptor } from "@vyoh/shared";
import { selectChapters } from "@vyoh/shared";

import { PrismaService } from "../prisma/prisma.service";
import { SteamOwnedGamesService } from "../steam/owned-games.service";
import { RECAP_HIDDEN_APPIDS } from "./recap-curation";

/**
 * Steam-subject candidate enumeration for the landing-page recap chapter
 * stream. Reads owned games (already filtered to currently-owned via the
 * service's `removedAt: null` join) and joins per-game unlock signal so a
 * recency-decayed score can be computed without a per-game round-trip.
 *
 * R-4a scope: Steam subjects only. LoL and Steam moment candidates land in
 * R-6/R-7 and feed the same `selectChapters` selector. The selector caps
 * per-kind and concatenates kinds in fixed order — see the shared scoring
 * module for the cross-kind contract.
 *
 * The Ahri chapter is a hardcoded structural anchor on the web side, not a
 * candidate here, per the arc note (ADR-6). This service produces only the
 * algorithmic list that sits *below* the anchor.
 */
@Injectable()
export class RecapSubjectsService {
  constructor(
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly prisma: PrismaService
  ) {}

  async getChapters(now: Date = new Date()): Promise<RecapChapterDescriptor[]> {
    const candidates = await this.collectSteamSubjectCandidates(now);
    return selectChapters(candidates);
  }

  private async collectSteamSubjectCandidates(now: Date): Promise<RecapCandidate[]> {
    // Three reads run in parallel — they touch independent tables, so
    // serialising would only buy idle wall-clock.
    const [ownedGames, unlockSignal] = await Promise.all([
      this.ownedGames.getOwnedGames(),
      this.prisma.steamPlayerUnlock.groupBy({
        by: ["appid"],
        _max: { unlockedAt: true },
        _count: { apiName: true },
      }),
    ]);

    const unlockByAppid = new Map<
      number,
      { lastUnlockAt: Date | null; unlockCount: number }
    >(
      unlockSignal.map((row) => [
        row.appid,
        {
          lastUnlockAt: row._max.unlockedAt ?? null,
          unlockCount: row._count.apiName,
        },
      ])
    );

    const candidates: RecapCandidate[] = [];
    for (const game of ownedGames.games) {
      if (RECAP_HIDDEN_APPIDS.has(game.appid)) continue;

      const unlock = unlockByAppid.get(game.appid);
      const lastUnlockMs = unlock?.lastUnlockAt?.getTime() ?? null;
      const lastPlayedMs = game.rtimeLastPlayedAt
        ? new Date(game.rtimeLastPlayedAt).getTime()
        : null;
      const freshest =
        lastUnlockMs !== null && lastPlayedMs !== null
          ? Math.max(lastUnlockMs, lastPlayedMs)
          : (lastUnlockMs ?? lastPlayedMs);
      // No recency signal at all → skip. The arc never wants a chapter that
      // says "you've never opened this" — the floor in the selector would
      // drop it anyway once decay kicks in, but skipping here keeps the
      // candidate pool small and avoids fighting `Math.exp(NaN)`.
      if (freshest === null) continue;

      const daysSince = Math.max(
        0,
        Math.floor((now.getTime() - freshest) / (1000 * 60 * 60 * 24))
      );

      // base_signal per the arc note: playtime hours + 0.5 × unlock count.
      // Unlocks are the *user's* unlocks (groupBy SteamPlayerUnlock), not
      // the schema's total achievements — engagement, not catalogue depth.
      const playtimeHours = game.playtimeForeverMinutes / 60;
      const unlockCount = unlock?.unlockCount ?? 0;
      const baseSignal = playtimeHours * 1.0 + unlockCount * 0.5;

      candidates.push({
        kind: "steam-subject",
        slug: `steam-${game.appid}`,
        appid: game.appid,
        name: game.name,
        baseSignal,
        daysSince,
      });
    }
    return candidates;
  }
}
