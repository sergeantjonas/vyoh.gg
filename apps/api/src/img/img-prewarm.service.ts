import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamService } from "../steam/steam.service";

// Boot-time loop that walks every asset path the owner cares about (LoL
// roster × variants, Steam owned + wishlist × routes) and hits the image
// proxy for each. The point isn't to fill an API-side cache — there isn't
// one — it's to populate the Nginx HTTP cache that will sit in front of the
// proxy at the hosting sweep. Until then the requests do real work and are
// discarded by the prewarm itself; the loop is wired now so it's exercised
// on every boot and can be flipped on in production with two env flags.
//
// Gated behind `STEAM_PREWARM=1` and `LOL_PREWARM=1` independently so dev
// restarts don't repeatedly hit upstream CDNs for nothing. Concurrency is
// capped at 2 in-flight requests with a small inter-request delay; the loop
// is deliberately slow because the upstream CDNs are shared infrastructure.

const STEAM_ROUTES = ["capsule", "library-capsule", "hero", "logo", "backdrop"] as const;
const LOL_CHAMPION_VARIANTS = ["square", "card", "backdrop"] as const;
const MAX_IN_FLIGHT = 2;
const INTER_REQUEST_DELAY_MS = 50;
// Wait this long after app bootstrap before starting — gives the Nest HTTP
// server time to bind to its port (we fetch from localhost) and avoids
// racing against the first user request.
const BOOT_DELAY_MS = 30_000;

const CDRAGON_CHAMPION_SUMMARY =
  "https://cdn.communitydragon.org/latest/champion-summary.json";
const DDRAGON_VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json";

interface ChampionSummaryEntry {
  id: number;
  alias: string;
}

@Injectable()
export class ImgPrewarmService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ImgPrewarmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamService
  ) {}

  onApplicationBootstrap(): void {
    const steam = process.env.STEAM_PREWARM === "1";
    const lol = process.env.LOL_PREWARM === "1";
    if (!steam && !lol) return;
    setTimeout(() => {
      const tasks: Promise<void>[] = [];
      if (steam) tasks.push(this.prewarmSteam());
      if (lol) tasks.push(this.prewarmLol());
      Promise.all(tasks).catch((err) => {
        this.logger.error("prewarm loop crashed", err);
      });
    }, BOOT_DELAY_MS);
  }

  private async prewarmSteam(): Promise<void> {
    const appids = await this.collectSteamAppids();
    if (appids.length === 0) {
      this.logger.log("steam prewarm: no appids to warm, skipping");
      return;
    }
    const baseUrl = this.baseUrl();
    const total = appids.length * STEAM_ROUTES.length;
    this.logger.log(
      `steam prewarm: ${appids.length} appids × ${STEAM_ROUTES.length} routes = ${total} requests`
    );
    const urls: string[] = [];
    for (const appid of appids) {
      for (const route of STEAM_ROUTES) {
        urls.push(`${baseUrl}/img/steam/${route}/${appid}/0.webp`);
      }
    }
    const { ok, fail } = await this.driveQueue(urls);
    this.logger.log(`steam prewarm complete: ${ok} ok, ${fail} fail`);
  }

  private async prewarmLol(): Promise<void> {
    let aliases: string[];
    let patch: string;
    try {
      [aliases, patch] = await Promise.all([
        this.fetchChampionAliases(),
        this.fetchLatestPatch(),
      ]);
    } catch (err) {
      this.logger.warn(`lol prewarm: bootstrap fetch failed (${String(err)}); skipping`);
      return;
    }
    if (aliases.length === 0) {
      this.logger.log("lol prewarm: empty roster, skipping");
      return;
    }
    const baseUrl = this.baseUrl();
    const total = aliases.length * LOL_CHAMPION_VARIANTS.length;
    this.logger.log(
      `lol prewarm: ${aliases.length} champions × ${LOL_CHAMPION_VARIANTS.length} variants = ${total} requests`
    );
    const urls: string[] = [];
    for (const alias of aliases) {
      const slug = alias.toLowerCase();
      for (const variant of LOL_CHAMPION_VARIANTS) {
        urls.push(`${baseUrl}/img/lol/champion/${slug}/${variant}/${patch}.webp`);
      }
    }
    const { ok, fail } = await this.driveQueue(urls);
    this.logger.log(`lol prewarm complete: ${ok} ok, ${fail} fail`);
  }

  private async driveQueue(urls: string[]): Promise<{ ok: number; fail: number }> {
    let inFlight = 0;
    let ok = 0;
    let fail = 0;
    const queue: Promise<void>[] = [];
    for (const url of urls) {
      while (inFlight >= MAX_IN_FLIGHT) {
        await sleep(INTER_REQUEST_DELAY_MS);
      }
      inFlight++;
      const p = fetch(url)
        .then((res) => {
          if (res.ok) ok++;
          else fail++;
        })
        .catch(() => {
          fail++;
        })
        .finally(() => {
          inFlight--;
        });
      queue.push(p);
      await sleep(INTER_REQUEST_DELAY_MS);
    }
    await Promise.all(queue);
    return { ok, fail };
  }

  private async collectSteamAppids(): Promise<number[]> {
    const owned = await this.prisma.steamOwnedGame.findMany({ select: { appid: true } });
    const ownedAppids = owned.map((g) => g.appid);
    let wishlistAppids: number[] = [];
    try {
      const wishlist = await this.steam.getOwnerWishlist();
      wishlistAppids = wishlist.items.map((i) => i.appid);
    } catch (err) {
      this.logger.warn(
        `steam prewarm: wishlist fetch failed (${String(err)}); proceeding with owned only`
      );
    }
    return Array.from(new Set([...ownedAppids, ...wishlistAppids]));
  }

  private async fetchChampionAliases(): Promise<string[]> {
    const res = await fetch(CDRAGON_CHAMPION_SUMMARY);
    if (!res.ok) throw new Error(`champion-summary HTTP ${res.status}`);
    const raw = (await res.json()) as ChampionSummaryEntry[];
    // -1 is CDragon's "Default" entry; skip it.
    return raw.filter((c) => c.id > 0).map((c) => c.alias);
  }

  private async fetchLatestPatch(): Promise<string> {
    const res = await fetch(DDRAGON_VERSIONS);
    if (!res.ok) throw new Error(`versions HTTP ${res.status}`);
    const versions = (await res.json()) as string[];
    return versions[0] ?? "latest";
  }

  private baseUrl(): string {
    const port = process.env.PORT ?? "2010";
    return `http://127.0.0.1:${port}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
