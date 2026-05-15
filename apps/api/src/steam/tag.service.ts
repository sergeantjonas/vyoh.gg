import { Injectable, Logger } from "@nestjs/common";
import type { SteamTagCatalog } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";

@Injectable()
export class SteamTagService {
  private readonly logger = new Logger(SteamTagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService
  ) {}

  // Pulls Steam's global community-tag catalog and upserts each row. Steam's
  // catalog is in the low thousands of entries, so a per-row upsert in a
  // single transaction is fine — no batching needed. Stale tags Steam has
  // removed are left in place: they're harmless if a SteamGameEnrichment row
  // still references them, and removing them risks orphaning a label the
  // frontend already shipped.
  async syncTags(): Promise<number> {
    const start = Date.now();
    const tags = await this.client.getTagList();
    if (tags.length === 0) {
      this.logger.warn("getTagList returned no rows — skipping upsert");
      return 0;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const tag of tags) {
        await tx.steamTag.upsert({
          where: { id: tag.tagid },
          create: { id: tag.tagid, name: tag.name },
          update: { name: tag.name },
        });
      }
    });

    const duration = Date.now() - start;
    this.logger.log(`synced ${tags.length} tags in ${duration}ms`);
    return tags.length;
  }

  // Catalog read for the controller. No Steam API call — read straight from
  // the local SteamTag table. Sorted by name so the popover renders a stable
  // alphabetical list; the frontend can still re-sort by frequency over the
  // owner's library against this base.
  async getCatalog(): Promise<SteamTagCatalog> {
    // Two queries — alphabetical for the popover, separate max for the meta
    // line. Cleaner than reduce-over-rows and lets Postgres pick its index.
    const [rows, latest] = await Promise.all([
      this.prisma.steamTag.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.steamTag.findFirst({
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return {
      tags: rows,
      lastSyncedAt: latest?.updatedAt.toISOString() ?? null,
    };
  }
}
