import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "blurhash";
import { Vibrant } from "node-vibrant/node";
import sharp from "sharp";
import { CHAMPION_COLOR_OVERRIDES } from "./overrides.js";

// Champion list comes from CDragon — text metadata, not images. Image
// assets (square + centered splash) are sourced from the wiki to honour the
// project's wiki-primary image rule.
const CHAMPION_SUMMARY_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json";
const WIKI_IMAGES = "https://wiki.leagueoflegends.com/en-us/images";

interface RawChampion {
  id: number;
  alias: string;
  name: string;
}

interface ChampionAsset {
  dominantHex: string;
  blurhash: string;
}

// HSL-style chroma in [0,1]. Used to rank swatches purely by saturation:
// pop-weighted scoring always loses to large face/skin clusters
// (`Loading Muted pop=469` dominates Akali's hood `Vibrant pop=2`), so the
// only way to surface iconic outfit hues is to ignore population entirely
// and pick the most-saturated cluster across both source palettes.
function hexChroma(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

// Wiki uses `Nunu` for every `Nunu & Willump` file. Mirrors
// `wikiChampionPrefix` in apps/api/src/img/wiki-url-helpers.ts.
function wikiChampionPrefix(displayName: string): string {
  if (displayName === "Nunu & Willump") return "Nunu";
  return displayName;
}

// Mirrors `wikiImageSlug` in apps/api/src/img/wiki-url-helpers.ts —
// spaces become `_`, apostrophes URL-encode to `%27` (Kai'Sa → Kai%27Sa).
function wikiImageSlug(name: string): string {
  return name.replace(/ /g, "_").replace(/'/g, "%27");
}

function wikiLoadingUrl(displayName: string): string {
  const slug = wikiImageSlug(wikiChampionPrefix(displayName));
  return `${WIKI_IMAGES}/${slug}_OriginalLoading.jpg`;
}

function wikiSquareUrl(displayName: string): string {
  const slug = wikiImageSlug(wikiChampionPrefix(displayName));
  return `${WIKI_IMAGES}/${slug}_OriginalSquare.png`;
}

function wikiCenteredUrl(displayName: string): string {
  const slug = wikiImageSlug(wikiChampionPrefix(displayName));
  return `${WIKI_IMAGES}/${slug}_OriginalCentered.jpg`;
}

async function processChampion(c: RawChampion): Promise<ChampionAsset> {
  // Three image sources combined for color extraction:
  // - Loading portrait (308×560): full upper body + outfit. Surfaces dress
  //   / suit / sash colors (Ahri red, Kai'Sa purple, Wukong sash) when
  //   they're prominent.
  // - Square icon (~120×120): tight head crop. Surfaces hood / hair /
  //   eye-aura colors (Akali green, Vex purple, Yasuo sky-blue) that
  //   loading misses.
  // Picker runs across the union of both palettes and selects the
  // highest-chroma cluster with non-zero population. See `hexChroma` for
  // why population is ignored.
  //
  // Centered splash (1280×720) for blurhash — matches what champion-card
  // and sticky-strip actually render, so the placeholder reads as the
  // right shape during load.
  const loadingUrl = wikiLoadingUrl(c.name);
  const squareUrl = wikiSquareUrl(c.name);
  const centeredUrl = wikiCenteredUrl(c.name);

  const [loadingRes, squareRes, centeredRes] = await Promise.all([
    fetch(loadingUrl),
    fetch(squareUrl),
    fetch(centeredUrl),
  ]);
  if (!loadingRes.ok)
    throw new Error(`fetch ${c.alias} loading → HTTP ${loadingRes.status}`);
  if (!squareRes.ok)
    throw new Error(`fetch ${c.alias} square → HTTP ${squareRes.status}`);
  if (!centeredRes.ok)
    throw new Error(`fetch ${c.alias} centered → HTTP ${centeredRes.status}`);
  const loadingBuffer = Buffer.from(await loadingRes.arrayBuffer());
  const squareBuffer = Buffer.from(await squareRes.arrayBuffer());
  const centeredBuffer = Buffer.from(await centeredRes.arrayBuffer());

  const override = CHAMPION_COLOR_OVERRIDES[c.alias];
  let dominantHex: string;
  if (override) {
    dominantHex = override;
  } else {
    const [loadingPalette, squarePalette] = await Promise.all([
      Vibrant.from(loadingBuffer).getPalette(),
      Vibrant.from(squareBuffer).getPalette(),
    ]);
    const allSwatches = [
      ...Object.values(loadingPalette),
      ...Object.values(squarePalette),
    ].filter((s): s is NonNullable<typeof s> => s != null && s.population > 0);
    const ranked = allSwatches.sort((a, b) => hexChroma(b.hex) - hexChroma(a.hex));
    dominantHex = ranked[0]?.hex ?? "#888888";
  }

  const { data, info } = await sharp(centeredBuffer)
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
  const all = (await res.json()) as RawChampion[];
  // `Ruby_*` aliases are TFT/Arena variants reusing base champion identities
  // — no separate wiki page exists, so skip them.
  const champions = all.filter((c) => c.id !== -1 && !c.alias.startsWith("Ruby_"));
  console.log(`${champions.length} champions to process`);

  const start = Date.now();
  const settled = await processChunked(champions, 8, async (c) => {
    process.stdout.write(".");
    return processChampion(c);
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
  const outPath = resolve(
    __dirname,
    "../../../apps/web/src/lol/_shared/assets/champion-assets.json"
  );
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
