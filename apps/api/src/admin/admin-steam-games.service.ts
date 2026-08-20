import { Injectable } from "@nestjs/common";
import type {
  AdminSteamGame,
  AdminSteamGameList,
  AdminSteamReviewCount,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamGameCurationService } from "../steam/game-curation.service";
import type { UpdateSteamGameCurationDto } from "./admin-steam-games.dto";

type CurationRow = {
  appid: number;
  name: string | null;
  hiddenAt: Date | null;
  unfeaturedAt: Date | null;
  reviewedAt: Date | null;
  note: string | null;
  createdAt: Date;
};

@Injectable()
export class AdminSteamGamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curation: SteamGameCurationService
  ) {}

  async list(): Promise<AdminSteamGameList> {
    const rows = await this.prisma.steamGameCuration.findMany({
      // Unreviewed first — the whole point of the surface is ruling on those —
      // then newest decision first.
      orderBy: [{ reviewedAt: "asc" }, { createdAt: "desc" }],
    });

    const names = await this.resolveNames(rows);
    return {
      entries: rows.map((row) => this.project(row, names)),
      pendingReview: rows.filter((row) => row.reviewedAt === null).length,
    };
  }

  async reviewCount(): Promise<AdminSteamReviewCount> {
    return { pendingReview: await this.curation.pendingReviewCount() };
  }

  /**
   * Upsert, because curating an appid is the same act whether or not it has
   * been curated before, and the client should not have to know which.
   */
  async update(appid: number, dto: UpdateSteamGameCurationDto): Promise<AdminSteamGame> {
    const now = new Date();
    const patch = {
      ...(dto.hidden === undefined ? {} : { hiddenAt: dto.hidden ? now : null }),
      ...(dto.unfeatured === undefined
        ? {}
        : { unfeaturedAt: dto.unfeatured ? now : null }),
      ...(dto.reviewed === undefined ? {} : { reviewedAt: dto.reviewed ? now : null }),
      ...(dto.note === undefined ? {} : { note: dto.note }),
    };

    const row = await this.prisma.steamGameCuration.upsert({
      where: { appid },
      update: patch,
      create: {
        appid,
        name: dto.name ?? (await this.ownedGameName(appid)),
        // A row the owner created by hand is a ruling by definition, so it is
        // reviewed on arrival unless the request says otherwise. Only the
        // poller mints unreviewed rows.
        reviewedAt: now,
        ...patch,
      },
    });

    this.curation.invalidate();
    return this.project(row, await this.resolveNames([row]));
  }

  /**
   * Drops the overlay row entirely, returning the game to plain visible and
   * featurable. Distinct from `{ hidden: false }`, which keeps the row — and so
   * keeps the note, the review timestamp, and the record that a decision was
   * once made here.
   */
  async remove(appid: number): Promise<void> {
    await this.prisma.steamGameCuration.deleteMany({ where: { appid } });
    this.curation.invalidate();
  }

  private project(row: CurationRow, names: Map<number, string>): AdminSteamGame {
    return {
      appid: row.appid,
      name: row.name ?? names.get(row.appid) ?? null,
      hiddenAt: row.hiddenAt?.toISOString() ?? null,
      unfeaturedAt: row.unfeaturedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Names for rows that carry none of their own. `SteamOwnedGame` is the only
   * table that holds one — neither enrichment nor wishlist assets do — so a
   * curated appid that was never owned shows whatever name the request supplied,
   * or nothing.
   */
  private async resolveNames(
    rows: readonly { appid: number }[]
  ): Promise<Map<number, string>> {
    const missing = rows.map((r) => r.appid);
    if (missing.length === 0) return new Map();

    const owned = await this.prisma.steamOwnedGame.findMany({
      where: { appid: { in: missing } },
      select: { appid: true, name: true },
    });
    return new Map(owned.map((g) => [g.appid, g.name]));
  }

  private async ownedGameName(appid: number): Promise<string | null> {
    const game = await this.prisma.steamOwnedGame.findUnique({
      where: { appid },
      select: { name: true },
    });
    return game?.name ?? null;
  }
}
