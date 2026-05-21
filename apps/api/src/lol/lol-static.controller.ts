import { Controller, Get, NotFoundException, Param, ParseIntPipe } from "@nestjs/common";
import type { LolAbilityDescriptionDto, LolStaticBundle } from "@vyoh/shared";
import { LolStaticSyncService } from "./lol-static-sync.service";

@Controller("lol/static")
export class LolStaticController {
  constructor(private readonly staticSync: LolStaticSyncService) {}

  // GET /lol/static → single bundle for the web app to fetch once on boot.
  // Replaces five client-side CDragon JSON fetches; TanStack Query caches
  // with `staleTime: Infinity`. See
  // docs/working-notes/lol/lol-static-metadata.md.
  @Get()
  async getBundle(): Promise<LolStaticBundle> {
    return this.staticSync.getBundle();
  }

  // GET /lol/static/ability/:championId/:slot/:abilityIndex → lazy resolver
  // for ability descriptions. The bundle endpoint only ships ability rows'
  // identity (slot + abilityIndex + name); description content is fetched
  // per-ability on demand and cached via the row's `wikiSyncedPatchVersion`
  // watermark. See docs/working-notes/lol/lazy-ability-descriptions.md.
  @Get("ability/:championId/:slot/:abilityIndex")
  async getAbilityDescription(
    @Param("championId", ParseIntPipe) championId: number,
    @Param("slot") slot: string,
    @Param("abilityIndex", ParseIntPipe) abilityIndex: number
  ): Promise<LolAbilityDescriptionDto> {
    const dto = await this.staticSync.ensureAbilityDescription(
      championId,
      slot,
      abilityIndex
    );
    if (!dto) {
      throw new NotFoundException(
        `Unknown ability ${championId}/${slot}/${abilityIndex}`
      );
    }
    return dto;
  }
}
