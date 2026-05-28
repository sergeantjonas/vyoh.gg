// One-shot probe to inspect Steam's `trailers.highlights[].adaptive_trailers`
// field shape on a few representative games. Field is not currently typed in
// types.ts; this script's output drives the next arc (full-trailer modal on
// game-detail). Dumps the raw highlights[0] for each appid so we see exactly
// what Steam returns — adaptive_trailers candidate URLs, codecs, manifests.
//
// Build first (pnpm build in apps/api), then:
//   node dist/src/scripts/probe-adaptive-trailers.js

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { SteamClientService } from "../steam/steam-client.service";

// RE4 (the one we just got working) + a couple other titles likely to have
// adaptive_trailers: Hollow Knight, Elden Ring, Cyberpunk 2077.
const APPIDS = [2050650, 367520, 1245620, 1091500];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["warn", "error"],
  });

  try {
    const client = app.get(SteamClientService);
    const items = await client.getStoreItemsFull(APPIDS);

    for (const item of items) {
      const trailers = (item as unknown as { trailers?: unknown }).trailers;
      console.log(`\n=== ${item.appid} (${item.name ?? "<no name>"}) ===`);
      console.log(JSON.stringify(trailers, null, 2));
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
