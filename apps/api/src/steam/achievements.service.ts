import { Injectable } from "@nestjs/common";
import type { SteamGameAchievements, SteamRecentUnlocks } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

export const RECENT_UNLOCKS_DEFAULT_LIMIT = 10;
export const RECENT_UNLOCKS_MAX_LIMIT = 200;

// Cross-game rarest is a curated leaderboard, not a feed — cap is tighter
// than recent's 200 since past ~50 the visual register stops being a
// "signature" and starts being noise.
export const RAREST_UNLOCKS_DEFAULT_LIMIT = 10;
export const RAREST_UNLOCKS_MAX_LIMIT = 50;

@Injectable()
export class SteamAchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  // Per-game achievement panel data. Returns null `achievements` array when
  // the game has no schema (CS2, demos) — frontend hides the panel block.
  // Empty array means the schema poller hasn't ingested rows yet (first-
  // deploy edge case for a freshly-added game). Spoiler masking happens
  // client-side based on the `hidden` + `unlockedAt` fields; the server
  // always returns the real `displayName` and `description` so other
  // surfaces can apply their own rules.
  async getGameAchievements(appid: number): Promise<SteamGameAchievements> {
    const meta = await this.prisma.steamGameAchievementMeta.findUnique({
      where: { appid },
      select: {
        achievementCount: true,
        lastSchemaCheckedAt: true,
        lastUnlocksCheckedAt: true,
        lastRarityCheckedAt: true,
      },
    });

    const empty: SteamGameAchievements = {
      appid,
      achievements:
        meta === null || meta.achievementCount === null
          ? null
          : meta.achievementCount === 0
            ? null
            : [],
      lastSchemaCheckedAt: meta?.lastSchemaCheckedAt?.toISOString() ?? null,
      lastUnlocksCheckedAt: meta?.lastUnlocksCheckedAt?.toISOString() ?? null,
      lastRarityCheckedAt: meta?.lastRarityCheckedAt?.toISOString() ?? null,
    };

    if (empty.achievements === null) return empty;

    const rows = await this.prisma.steamGameAchievement.findMany({
      where: { appid },
      include: { unlock: true, rarity: true },
    });

    // Sort in-memory rather than via Prisma's relation order — small N
    // (typically 30-100 per game), and the relation-orderBy with nulls-last
    // semantics isn't worth threading through for a per-request handler.
    // Unlocked first (most-recent at top), then locked (alpha by display
    // name). Matches Steam client's own per-game panel ordering.
    const achievements = rows
      .map((r) => ({
        apiName: r.apiName,
        displayName: r.displayName,
        description: r.description,
        iconUrl: r.iconUrl,
        iconGrayUrl: r.iconGrayUrl,
        hidden: r.hidden,
        unlockedAt: r.unlock?.unlockedAt.toISOString() ?? null,
        globalPercent: r.rarity?.percent ?? null,
      }))
      .sort((a, b) => {
        if (a.unlockedAt !== null && b.unlockedAt !== null) {
          return b.unlockedAt.localeCompare(a.unlockedAt);
        }
        if (a.unlockedAt !== null) return -1;
        if (b.unlockedAt !== null) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

    return { ...empty, achievements };
  }

  // Cross-game recent-unlocks feed. Ordered by `unlockedAt` desc using the
  // index on `SteamPlayerUnlock.unlockedAt`. Caller passes the limit
  // (default 10, hard cap 200) — the same endpoint backs the Profile chip
  // and the global achievements page with different visible counts.
  async getRecentUnlocks(limit: number): Promise<SteamRecentUnlocks> {
    const clamped = Math.min(Math.max(1, Math.floor(limit)), RECENT_UNLOCKS_MAX_LIMIT);

    const rows = await this.prisma.steamPlayerUnlock.findMany({
      orderBy: { unlockedAt: "desc" },
      take: clamped,
      include: {
        achievement: {
          include: {
            game: { select: { name: true } },
            rarity: true,
          },
        },
      },
    });

    return {
      unlocks: rows.map((r) => ({
        appid: r.appid,
        gameName: r.achievement.game.name,
        apiName: r.apiName,
        displayName: r.achievement.displayName,
        iconUrl: r.achievement.iconUrl,
        hidden: r.achievement.hidden,
        unlockedAt: r.unlockedAt.toISOString(),
        globalPercent: r.achievement.rarity?.percent ?? null,
      })),
    };
  }

  // Cross-game rarest unlocks — the owner's top-N rarest achievements across
  // the entire library, ordered by `rarity.percent` ascending. Rows without
  // a recorded rarity (`rarity` row missing — weekly poller hasn't covered
  // them yet) are excluded rather than ranked as 0%; a null rarity isn't
  // "very rare," it's "unknown." Shares the `SteamRecentUnlocks` payload
  // shape since the fields needed are identical.
  async getCrossGameRarest(limit: number): Promise<SteamRecentUnlocks> {
    const clamped = Math.min(Math.max(1, Math.floor(limit)), RAREST_UNLOCKS_MAX_LIMIT);

    const rows = await this.prisma.steamPlayerUnlock.findMany({
      where: { achievement: { rarity: { isNot: null } } },
      orderBy: { achievement: { rarity: { percent: "asc" } } },
      take: clamped,
      include: {
        achievement: {
          include: {
            game: { select: { name: true } },
            rarity: true,
          },
        },
      },
    });

    return {
      unlocks: rows.map((r) => ({
        appid: r.appid,
        gameName: r.achievement.game.name,
        apiName: r.apiName,
        displayName: r.achievement.displayName,
        iconUrl: r.achievement.iconUrl,
        hidden: r.achievement.hidden,
        unlockedAt: r.unlockedAt.toISOString(),
        globalPercent: r.achievement.rarity?.percent ?? null,
      })),
    };
  }
}
