import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "blurhash";
import { Vibrant } from "node-vibrant/node";
import sharp from "sharp";

const CDRAGON = "https://cdn.communitydragon.org/latest";
const CHAMPION_SUMMARY_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json";

interface RawChampion {
  id: number;
  alias: string;
  name: string;
}

interface ChampionAsset {
  dominantHex: string;
  blurhash: string;
}

async function processChampion(alias: string): Promise<ChampionAsset> {
  const url = `${CDRAGON}/champion/${alias.toLowerCase()}/splash-art`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${alias} splash → HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const palette = await Vibrant.from(buffer).getPalette();
  const dominantHex =
    palette.Vibrant?.hex ??
    palette.LightVibrant?.hex ??
    palette.DarkVibrant?.hex ??
    palette.Muted?.hex ??
    "#888888";

  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);

  return { dominantHex, blurhash };
}

async function processChunked<T, R>(
  items: T[],
  chunk: number,
  fn: (item: T) => Promise<R>
): Promise<Array<{ item: T; result: R } | { item: T; error: unknown }>> {
  const out: Array<{ item: T; result: R } | { item: T; error: unknown }> = [];
  for (let i = 0; i < items.length; i += chunk) {
    const slice = items.slice(i, i + chunk);
    const settled = await Promise.allSettled(slice.map(fn));
    settled.forEach((r, idx) => {
      const item = slice[idx];
      if (item === undefined) return;
      if (r.status === "fulfilled") out.push({ item, result: r.value });
      else out.push({ item, error: r.reason });
    });
  }
  return out;
}

async function main() {
  console.log("fetching champion summary…");
  const res = await fetch(CHAMPION_SUMMARY_URL);
  if (!res.ok) throw new Error(`champion summary fetch failed: HTTP ${res.status}`);
  const all: RawChampion[] = await res.json();
  const champions = all.filter((c) => c.id !== -1);
  console.log(`${champions.length} champions to process`);

  const start = Date.now();
  const settled = await processChunked(champions, 8, async (c) => {
    process.stdout.write(".");
    return processChampion(c.alias);
  });
  process.stdout.write("\n");

  const assets: Record<string, ChampionAsset> = {};
  const failures: string[] = [];
  for (const r of settled) {
    if ("result" in r) assets[r.item.alias] = r.result;
    else failures.push(`${r.item.alias}: ${r.error}`);
  }

  const sorted = Object.fromEntries(
    Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))
  );

  const output = {
    generated: new Date().toISOString(),
    count: Object.keys(sorted).length,
    champions: sorted,
  };

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(__dirname, "../../../apps/web/src/data/champion-assets.json");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`wrote ${output.count} champion assets in ${dur}s → ${outPath}`);
  if (failures.length > 0) {
    console.warn(`\n${failures.length} failures:`);
    for (const f of failures) console.warn(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
