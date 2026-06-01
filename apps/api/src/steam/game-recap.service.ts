import { Injectable, NotFoundException } from "@nestjs/common";
import { type SteamGameRecap, deriveSteamGameRecap } from "@vyoh/shared";

import { SteamAchievementsService } from "./achievements.service";
import { SteamOwnedGamesService } from "./owned-games.service";

/**
 * Composes the per-game recap shape consumed by the landing-page Steam
 * subject chapter (R-3). Pure aggregator — owns no DB queries of its own,
 * just orchestrates the existing per-aspect services (owned games,
 * achievements, screenshots) into one slim payload via the pure deriver in
 * `@vyoh/shared`.
 *
 * Returning a zero-state for an appid not in the library would silently
 * mask "this game isn't tracked" as "this game has no activity yet" — they
 * mean different things to the chapter (the latter is honest empty-state,
 * the former is a configuration mistake worth surfacing). We throw
 * NotFoundException so the frontend's query lands in the error branch
 * instead of rendering a misleading empty chapter.
 */
@Injectable()
export class SteamGameRecapService {
  constructor(
    private readonly ownedGames: SteamOwnedGamesService,
    private readonly achievements: SteamAchievementsService
  ) {}

  async getGameRecap(appid: number): Promise<SteamGameRecap> {
    // Three reads run in parallel — they touch independent tables so
    // serializing them would just buy idle wall-clock time.
    const [ownedGames, achievements, screenshots] = await Promise.all([
      this.ownedGames.getOwnedGames(),
      this.achievements.getGameAchievements(appid),
      this.ownedGames.getGameScreenshots(appid),
    ]);

    const ownedGame = ownedGames.games.find((g) => g.appid === appid) ?? null;
    if (ownedGame === null) {
      throw new NotFoundException(`Steam app ${appid} is not in the tracked library.`);
    }

    // Use the all-ages bucket — the mature bucket is gated behind a
    // (future) owner opt-in and isn't appropriate for a public-facing
    // landing-page subject chapter.
    return deriveSteamGameRecap(
      appid,
      ownedGame,
      achievements,
      screenshots.allAges,
      new Date()
    );
  }
}
