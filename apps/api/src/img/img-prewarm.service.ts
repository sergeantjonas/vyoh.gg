import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamService } from "../steam/steam.service";

// Boot-time loop that walks every appid the owner cares about (owned games +
// wishlist) and hits the image proxy for each. The point isn't to fill an
// API-side cache — there isn't one — it's to populate the Nginx HTTP cache
// that will sit in front of the proxy at the hosting sweep. Until then the
// requests do real work and are discarded by the prewarm itself; the loop
// is wired now so it's exercised on every boot and can be flipped on in
// production with a single env flag.
//
// Gated behind `STEAM_PREWARM=1` so dev restarts don't repeatedly hit Steam's
// CDN for nothing. Concurrency is capped at 2 in-flight requests with a small
// inter-request delay; the loop is deliberately slow because the upstream
// CDN is shared infrastructure.

const STEAM_ROUTES = ["capsule", "library-capsule", "hero", "logo", "backdrop"] as const;
const MAX_IN_FLIGHT = 2;
const INTER_REQUEST_DELAY_MS = 50;
// Wait this long after app bootstrap before starting — gives the Nest HTTP
// server time to bind to its port (we fetch from localhost) and avoids
// racing against the first user request.
const BOOT_DELAY_MS = 30_000;

@Injectable()
export class ImgPrewarmService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ImgPrewarmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly steam: SteamService
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.STEAM_PREWARM !== "1") return;
    setTimeout(() => {
      this.prewarm().catch((err) => {
        this.logger.error("prewarm loop crashed", err);
      });
    }, BOOT_DELAY_MS);
  }

  private async prewarm(): Promise<void> {
    const appids = await this.collectAppids();
    if (appids.length === 0) {
      this.logger.log("prewarm: no appids to warm, skipping");
      return;
    }

    const port = process.env.PORT ?? "2010";
    const baseUrl = `http://127.0.0.1:${port}`;
    const total = appids.length * STEAM_ROUTES.length;
    this.logger.log(
      `prewarm: ${appids.length} appids × ${STEAM_ROUTES.length} routes = ${total} requests`
    );

    let inFlight = 0;
    let ok = 0;
    let fail = 0;
    const queue: Promise<void>[] = [];

    for (const appid of appids) {
      for (const route of STEAM_ROUTES) {
        while (inFlight >= MAX_IN_FLIGHT) {
          await sleep(INTER_REQUEST_DELAY_MS);
        }
        inFlight++;
        const url = `${baseUrl}/img/steam/${route}/${appid}/0.webp`;
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
    }
    await Promise.all(queue);
    this.logger.log(`prewarm complete: ${ok} ok, ${fail} fail`);
  }

  private async collectAppids(): Promise<number[]> {
    const owned = await this.prisma.steamOwnedGame.findMany({ select: { appid: true } });
    const ownedAppids = owned.map((g) => g.appid);
    let wishlistAppids: number[] = [];
    try {
      const wishlist = await this.steam.getOwnerWishlist();
      wishlistAppids = wishlist.items.map((i) => i.appid);
    } catch (err) {
      this.logger.warn(
        `prewarm: wishlist fetch failed (${String(err)}); proceeding with owned only`
      );
    }
    return Array.from(new Set([...ownedAppids, ...wishlistAppids]));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
