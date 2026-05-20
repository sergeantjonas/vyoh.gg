import { Controller, Get } from "@nestjs/common";
import type { LolStaticBundle } from "@vyoh/shared";
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
}
