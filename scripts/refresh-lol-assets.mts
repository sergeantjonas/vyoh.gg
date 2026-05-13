#!/usr/bin/env tsx
// Build-time prefetch for the bounded LoL asset universe.
// See docs/working-notes/lol-image-pipeline.md (Phase 1) for design + decisions.
//
// Modes:
//   pnpm refresh:lol-assets               incremental (skip if patch unchanged + file exists)
//   pnpm refresh:lol-assets -- --full     re-fetch everything (after schema change or rework)
//   pnpm refresh:lol-assets -- --gaps-only retry only manifest.missing[] entries
//
// Produces:
//   apps/web/public/lol/manifest.json         — runtime-readable, imported by URL helpers
//   apps/web/public/lol/champion-summary.json — bundled (was runtime fetch)
//   apps/web/public/lol/champions/<alias>/{square,card,backdrop}.webp
//   apps/web/src/lol/_shared/champion-assets.json — theme/blurhash (regen on splash change)
//
// .cache/lol-images/ caches Sharp inputs/outputs keyed by source-URL+params hash.

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode as encodeBlurhash } from "blurhash";
import sharp from "sharp";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_LOL = path.join(REPO_ROOT, "apps/web/public/lol");
const SRC_LOL_SHARED = path.join(REPO_ROOT, "apps/web/src/lol/_shared");
const CACHE_DIR = path.join(REPO_ROOT, ".cache/lol-images");
const MANIFEST_PATH = path.join(PUBLIC_LOL, "manifest.json");
const CHAMPION_SUMMARY_PATH = path.join(PUBLIC_LOL, "champion-summary.json");
const CHAMPION_ASSETS_PATH = path.join(SRC_LOL_SHARED, "champion-assets.json");
const SCHEMA_VERSION = 1;

const DDRAGON_VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json";
const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON_LATEST = "https://cdn.communitydragon.org/latest";
const CDRAGON_RAW_LATEST = "https://raw.communitydragon.org/latest";
const CDRAGON_GAME_DATA = `${CDRAGON_RAW_LATEST}/plugins/rcp-be-lol-game-data/global/default`;
const CHAMPION_SUMMARY_URL = `${CDRAGON_GAME_DATA}/v1/champion-summary.json`;
const PERKS_URL = `${CDRAGON_GAME_DATA}/v1/perks.json`;
const SUMMONER_SPELLS_URL = `${CDRAGON_GAME_DATA}/v1/summoner-spells.json`;
const POSITION_SVG_BASE = `${CDRAGON_RAW_LATEST}/plugins/rcp-fe-lol-static-assets/global/default/svg`;
const POSITION_SLUGS = ["top", "jungle", "middle", "bottom", "utility"] as const;

const FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY_MS = 5_000;
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;
const MISSING_THRESHOLD = 0.05;

// Mirrors apps/web/src/lol/_shared/champion-icon.ts. Kept local to avoid the
// script depending on the web workspace's resolver.
const SWARM_PREFIX = "Strawberry_";
function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

interface ManifestAsset {
  path: string;
  hash: string;
  bytes: number;
}

interface ChampionEntry {
  square: ManifestAsset;
  card: ManifestAsset;
  backdrop: ManifestAsset;
}

interface MissingEntry {
  kind: string;
  key: string;
  reason: string;
}

interface Manifest {
  schemaVersion: number;
  patch: string;
  generatedAt: string;
  champions: Record<string, ChampionEntry>;
  items: Record<string, ManifestAsset>;
  runes: Record<string, ManifestAsset>;
  summonerSpells: Record<string, ManifestAsset>;
  roleIcons: Record<string, ManifestAsset>;
  missing: MissingEntry[];
}

interface ChampionThemeEntry {
  dominantHex: string;
  blurhash: string;
}

interface ChampionThemeFile {
  generated: string;
  count: number;
  champions: Record<string, ChampionThemeEntry>;
}

interface RawChampionSummary {
  id: number;
  alias: string;
  name: string;
}

interface RawCDragonAsset {
  id: number;
  iconPath: string;
  name?: string;
}

// CDragon iconPath fields are absolute paths into the
// rcp-be-lol-game-data plugin's virtual asset tree. Convert to a real
// HTTPS URL by stripping the `/lol-game-data/assets/` prefix and lowercasing.
// Mirrors the transform used by apps/web/src/lol/_shared/use-perks.ts.
function cdragonIconUrl(iconPath: string): string {
  return (
    CDRAGON_GAME_DATA + iconPath.replace("/lol-game-data/assets/", "/").toLowerCase()
  );
}

const argv = new Set(process.argv.slice(2));
const MODE: "default" | "full" | "gaps-only" = argv.has("--full")
  ? "full"
  : argv.has("--gaps-only")
    ? "gaps-only"
    : "default";

async function main(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(PUBLIC_LOL, { recursive: true });
  await mkdir(path.join(PUBLIC_LOL, "champions"), { recursive: true });

  const prevManifest = await readManifest();
  const patch = await fetchLatestPatch();
  const champions = await fetchChampionSummary();
  await writeFile(CHAMPION_SUMMARY_PATH, JSON.stringify(champions, null, 2));

  // A patch bump invalidates incremental skips — CDragon "latest" content moved
  // beneath us. Treat as if --full was passed for this run.
  const patchChanged = prevManifest?.patch !== patch;
  const effectiveMode = MODE === "default" && patchChanged ? "full" : MODE;
  if (patchChanged && MODE === "default") {
    console.log(
      `patch changed (${prevManifest?.patch ?? "<none>"} -> ${patch}); forcing full refresh`
    );
  }

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    patch,
    generatedAt: new Date().toISOString(),
    champions: {},
    items: {},
    runes: {},
    summonerSpells: {},
    roleIcons: {},
    missing: [],
  };

  const themePrev = await readChampionAssetsFile();
  const themeNext: ChampionThemeFile = {
    generated: manifest.generatedAt,
    count: 0,
    champions: {},
  };

  const gapsOnly =
    effectiveMode === "gaps-only"
      ? new Set(
          prevManifest?.missing.filter((m) => m.kind === "champion").map((m) => m.key)
        )
      : null;

  const tasks = champions
    .filter((c) => c.id !== -1)
    .filter((c) => !gapsOnly || gapsOnly.has(normalizeChampionAlias(c.alias)))
    .map((c) => async () => {
      const key = normalizeChampionAlias(c.alias);
      const slug = key.toLowerCase();
      const prevEntry = prevManifest?.champions[key];
      const result = await processChampion({
        key,
        slug,
        effectiveMode,
        prevEntry,
        prevTheme: themePrev?.champions[key],
      });
      if (result.entry) manifest.champions[key] = result.entry;
      if (result.theme) themeNext.champions[key] = result.theme;
      for (const m of result.missing) manifest.missing.push(m);
    });

  let attempted = 0;
  let succeeded = 0;
  await runWithConcurrency(tasks, CONCURRENCY, () => {
    attempted++;
    if (attempted % 25 === 0) {
      process.stderr.write(`  champions: ${attempted}/${tasks.length}\n`);
    }
  });
  succeeded = Object.keys(manifest.champions).length;

  themeNext.count = Object.keys(themeNext.champions).length;
  await writeFile(CHAMPION_ASSETS_PATH, `${JSON.stringify(themeNext, null, 2)}\n`);

  const total = champions.filter((c) => c.id !== -1).length;
  const missingCount = manifest.missing.filter((m) => m.kind === "champion").length;
  console.log(
    `champions: refreshed ${succeeded}/${total} (attempted ${attempted}, missing ${missingCount})`
  );

  if (attempted > 0 && missingCount / Math.max(attempted, 1) > MISSING_THRESHOLD) {
    console.error(
      `missing/attempted ratio ${(missingCount / attempted).toFixed(3)} > ${MISSING_THRESHOLD}; structural failure?`
    );
    process.exit(1);
  }

  // Bundled secondary asset classes. Each driver populates its slice of the
  // manifest and pushes any per-key failures into manifest.missing — same
  // shape and structural-failure semantics as champions.
  await processItems({ manifest, prevManifest, effectiveMode, patch });
  await processPerks({ manifest, prevManifest, effectiveMode });
  await processSummonerSpells({ manifest, prevManifest, effectiveMode });
  await processRoleIcons({ manifest, prevManifest, effectiveMode });

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  // assertManifestConsistency: every entry has a real file on disk.
  await assertManifestFiles(manifest);
}

async function assertManifestFiles(manifest: Manifest): Promise<void> {
  for (const [key, entry] of Object.entries(manifest.champions)) {
    for (const variant of ["square", "card", "backdrop"] as const) {
      await assertAssetOnDisk(`champion:${key}:${variant}`, entry[variant]);
    }
  }
  for (const [key, asset] of Object.entries(manifest.items)) {
    await assertAssetOnDisk(`item:${key}`, asset);
  }
  for (const [key, asset] of Object.entries(manifest.runes)) {
    await assertAssetOnDisk(`rune:${key}`, asset);
  }
  for (const [key, asset] of Object.entries(manifest.summonerSpells)) {
    await assertAssetOnDisk(`summoner-spell:${key}`, asset);
  }
  for (const [key, asset] of Object.entries(manifest.roleIcons)) {
    await assertAssetOnDisk(`role-icon:${key}`, asset);
  }
}

async function assertAssetOnDisk(label: string, asset: ManifestAsset): Promise<void> {
  const filePath = urlPathToDiskPath(asset.path);
  try {
    await stat(filePath);
  } catch {
    throw new Error(`manifest references missing file: ${label} -> ${filePath}`);
  }
}

async function readManifest(): Promise<Manifest | undefined> {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Manifest;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(
        `manifest schemaVersion ${parsed.schemaVersion} != ${SCHEMA_VERSION}; treating as empty`
      );
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

async function readChampionAssetsFile(): Promise<ChampionThemeFile | undefined> {
  try {
    const raw = await readFile(CHAMPION_ASSETS_PATH, "utf8");
    return JSON.parse(raw) as ChampionThemeFile;
  } catch {
    return undefined;
  }
}

async function fetchLatestPatch(): Promise<string> {
  const versions = await fetchJson<string[]>(DDRAGON_VERSIONS);
  const head = versions[0];
  if (!head) throw new Error("DDragon versions.json returned empty");
  return head;
}

async function fetchChampionSummary(): Promise<RawChampionSummary[]> {
  return fetchJson<RawChampionSummary[]>(CHAMPION_SUMMARY_URL);
}

interface ChampionProcessOptions {
  key: string;
  slug: string;
  effectiveMode: "default" | "full" | "gaps-only";
  prevEntry: ChampionEntry | undefined;
  prevTheme: ChampionThemeEntry | undefined;
}

interface ChampionProcessResult {
  entry?: ChampionEntry;
  theme?: ChampionThemeEntry;
  missing: MissingEntry[];
}

async function processChampion(
  opts: ChampionProcessOptions
): Promise<ChampionProcessResult> {
  const { key, slug, effectiveMode, prevEntry, prevTheme } = opts;
  const missing: MissingEntry[] = [];
  const variants = {
    square: { width: 72, quality: 85, blur: undefined as number | undefined },
    card: { width: 500, quality: 90, blur: undefined as number | undefined },
    backdrop: { width: 600, quality: 80, blur: 1 },
  };
  const squareSrc = `${CDRAGON_LATEST}/champion/${slug}/square`;
  const splashSrc = `${CDRAGON_LATEST}/champion/${slug}/splash-art/centered`;
  const sources: Record<keyof typeof variants, string[]> = {
    square: [squareSrc],
    card: [splashSrc],
    backdrop: [splashSrc],
  };

  let splashBytes: Buffer | undefined;
  const entry: Partial<ChampionEntry> = {};
  let cardChanged = false;

  for (const variant of Object.keys(variants) as (keyof typeof variants)[]) {
    const params = variants[variant];
    const outRel = `/lol/champions/${key}/${variant}.webp`;
    const outAbs = urlPathToDiskPath(outRel);
    const prev = prevEntry?.[variant];
    const skip = effectiveMode === "default" && prev && (await fileExists(outAbs));
    if (skip && prev) {
      entry[variant] = prev;
      continue;
    }

    let processed: { bytes: Buffer; sourceBytes: Buffer } | undefined;
    for (const src of sources[variant]) {
      try {
        const sourceBytes = await fetchBinary(src);
        const transformed = await transformWebp(sourceBytes, params);
        processed = { bytes: transformed, sourceBytes };
        break;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`  ${key} ${variant} ${src}: ${reason}`);
      }
    }

    if (!processed) {
      missing.push({
        kind: "champion",
        key,
        reason: `all sources failed for ${variant} at ${new Date().toISOString()}`,
      });
      continue;
    }

    await mkdir(path.dirname(outAbs), { recursive: true });
    await writeFile(outAbs, processed.bytes);
    entry[variant] = {
      path: outRel,
      hash: sha256(processed.bytes),
      bytes: processed.bytes.length,
    };
    if (variant === "card") {
      splashBytes = processed.sourceBytes;
      cardChanged = true;
    }
  }

  if (!entry.square || !entry.card || !entry.backdrop) {
    return { missing };
  }

  let theme = prevTheme;
  if (cardChanged && splashBytes) {
    try {
      theme = await deriveTheme(splashBytes);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`  ${key} theme derive failed: ${reason}`);
      // Don't fail the whole entry over theme derivation.
    }
  }

  return {
    entry: entry as ChampionEntry,
    theme,
    missing,
  };
}

async function deriveTheme(sourceBytes: Buffer): Promise<ChampionThemeEntry> {
  const pipeline = sharp(sourceBytes);
  const statsImg = pipeline.clone();
  const stats = await statsImg.stats();
  const { r, g, b } = stats.dominant;
  const dominantHex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;

  // blurhash wants raw RGBA. 32×32 is the canonical low-res input that the
  // existing apps/web blurhash decoder is shaped for.
  const { data, info } = await pipeline
    .clone()
    .resize(32, 32, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encodeBlurhash(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    4,
    4
  );
  return { dominantHex, blurhash };
}

interface BundleContext {
  manifest: Manifest;
  prevManifest: Manifest | undefined;
  effectiveMode: "default" | "full" | "gaps-only";
}

interface ProcessAssetInput {
  kind: string;
  key: string;
  outRel: string;
  sources: string[];
  // null = pass-through (no Sharp transform); used for SVG role icons.
  params: VariantParams | null;
  prev: ManifestAsset | undefined;
  effectiveMode: "default" | "full" | "gaps-only";
  gapKeys: Set<string> | null;
}

async function processSimpleAsset(
  input: ProcessAssetInput
): Promise<{ asset?: ManifestAsset; missing?: MissingEntry }> {
  const { kind, key, outRel, sources, params, prev, effectiveMode, gapKeys } = input;
  if (effectiveMode === "gaps-only" && gapKeys && !gapKeys.has(key)) {
    return { asset: prev };
  }
  const outAbs = urlPathToDiskPath(outRel);
  if (effectiveMode === "default" && prev && (await fileExists(outAbs))) {
    return { asset: prev };
  }
  for (const src of sources) {
    try {
      const sourceBytes = await fetchBinary(src);
      const bytes = params ? await transformWebp(sourceBytes, params) : sourceBytes;
      await mkdir(path.dirname(outAbs), { recursive: true });
      await writeFile(outAbs, bytes);
      return {
        asset: { path: outRel, hash: sha256(bytes), bytes: bytes.length },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`  ${kind} ${key} ${src}: ${reason}`);
    }
  }
  return {
    missing: {
      kind,
      key,
      reason: `all sources failed at ${new Date().toISOString()}`,
    },
  };
}

async function runBundle(opts: {
  ctx: BundleContext;
  kind: string;
  bucket: "items" | "runes" | "summonerSpells" | "roleIcons";
  inputs: Omit<ProcessAssetInput, "effectiveMode" | "gapKeys">[];
}): Promise<void> {
  const { ctx, kind, bucket, inputs } = opts;
  const gapKeys =
    ctx.effectiveMode === "gaps-only"
      ? new Set(
          ctx.prevManifest?.missing.filter((m) => m.kind === kind).map((m) => m.key)
        )
      : null;
  const target = ctx.manifest[bucket];
  let attempted = 0;
  let succeeded = 0;
  const tasks = inputs.map((input) => async () => {
    attempted++;
    const result = await processSimpleAsset({
      ...input,
      effectiveMode: ctx.effectiveMode,
      gapKeys,
    });
    if (result.asset) {
      target[input.key] = result.asset;
      succeeded++;
    }
    if (result.missing) ctx.manifest.missing.push(result.missing);
  });
  await runWithConcurrency(tasks, CONCURRENCY, () => {});
  const missingCount = ctx.manifest.missing.filter((m) => m.kind === kind).length;
  console.log(
    `${kind}s: refreshed ${succeeded}/${inputs.length} (missing ${missingCount})`
  );
  if (attempted > 0 && missingCount / attempted > MISSING_THRESHOLD) {
    console.error(
      `${kind}: missing/attempted ratio ${(missingCount / attempted).toFixed(3)} > ${MISSING_THRESHOLD}; structural failure?`
    );
    process.exit(1);
  }
}

interface DDragonItem {
  data: Record<string, unknown>;
}

async function processItems(opts: BundleContext & { patch: string }): Promise<void> {
  const { patch } = opts;
  const itemFile = await fetchJson<DDragonItem>(
    `${DDRAGON_CDN}/${patch}/data/en_US/item.json`
  );
  const ids = Object.keys(itemFile.data);
  const inputs = ids.map((id) => ({
    kind: "item",
    key: id,
    outRel: `/lol/items/${id}.webp`,
    sources: [`${DDRAGON_CDN}/${patch}/img/item/${id}.png`],
    // Item icons are 64×64 on DDragon — withoutEnlargement keeps native size.
    params: { width: 64, quality: 85, blur: undefined } as VariantParams,
    prev: opts.prevManifest?.items[id],
  }));
  await runBundle({ ctx: opts, kind: "item", bucket: "items", inputs });
}

async function processPerks(ctx: BundleContext): Promise<void> {
  const perks = await fetchJson<RawCDragonAsset[]>(PERKS_URL);
  const inputs = perks.map((p) => ({
    kind: "rune",
    key: String(p.id),
    outRel: `/lol/runes/${p.id}.webp`,
    sources: [cdragonIconUrl(p.iconPath)],
    // Runtime displays runes at ≈20 CSS px; w=40 covers 2× retina.
    params: { width: 40, quality: 85, blur: undefined } as VariantParams,
    prev: ctx.prevManifest?.runes[String(p.id)],
  }));
  await runBundle({ ctx, kind: "rune", bucket: "runes", inputs });
}

async function processSummonerSpells(ctx: BundleContext): Promise<void> {
  const spells = await fetchJson<RawCDragonAsset[]>(SUMMONER_SPELLS_URL);
  const inputs = spells.map((s) => ({
    kind: "summoner-spell",
    key: String(s.id),
    outRel: `/lol/summoner-spells/${s.id}.webp`,
    sources: [cdragonIconUrl(s.iconPath)],
    params: { width: 40, quality: 85, blur: undefined } as VariantParams,
    prev: ctx.prevManifest?.summonerSpells[String(s.id)],
  }));
  await runBundle({ ctx, kind: "summoner-spell", bucket: "summonerSpells", inputs });
}

async function processRoleIcons(ctx: BundleContext): Promise<void> {
  const inputs = POSITION_SLUGS.map((slug) => ({
    kind: "role-icon",
    key: slug,
    outRel: `/lol/role-icons/position-${slug}.svg`,
    sources: [`${POSITION_SVG_BASE}/position-${slug}.svg`],
    // SVGs pass through unchanged — Sharp would rasterize and defeat the
    // crispness that the runtime <img> relies on.
    params: null,
    prev: ctx.prevManifest?.roleIcons[slug],
  }));
  await runBundle({ ctx, kind: "role-icon", bucket: "roleIcons", inputs });
}

interface VariantParams {
  width: number;
  quality: number;
  blur: number | undefined;
}

async function transformWebp(input: Buffer, params: VariantParams): Promise<Buffer> {
  const cacheKey = sha256(
    Buffer.concat([
      input,
      Buffer.from(`w=${params.width}|q=${params.quality}|b=${params.blur ?? 0}`),
    ])
  );
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.webp`);
  try {
    return await readFile(cachePath);
  } catch {
    // miss
  }
  let pipeline = sharp(input).resize({ width: params.width, withoutEnlargement: true });
  if (params.blur !== undefined) pipeline = pipeline.blur(params.blur);
  const out = await pipeline.webp({ quality: params.quality }).toBuffer();
  await writeFile(cachePath, out);
  return out;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url);
  return (await res.json()) as T;
}

async function fetchBinary(url: string): Promise<Buffer> {
  const cacheKey = sha256(Buffer.from(url));
  const cachePath = path.join(CACHE_DIR, `src-${cacheKey}.bin`);
  try {
    const cached = await readFile(cachePath);
    if (cached.length > 0) return cached;
  } catch {
    // miss
  }
  const res = await fetchWithRetry(url);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(cachePath, buf);
  return buf;
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ac.signal });
      clearTimeout(timer);
      if (!res.ok) {
        // 404s are terminal — retrying won't help and they're a signal the
        // upstream key changed (champion rename, removed item).
        if (res.status === 404) throw new Error(`HTTP 404 ${url}`);
        throw new Error(`HTTP ${res.status} ${url}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof Error && err.message.startsWith("HTTP 404")) throw err;
      if (attempt < FETCH_RETRIES) {
        await sleep(FETCH_RETRY_DELAY_MS);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// Manifest paths are runtime URLs ("/lol/..."), which Vite serves from
// apps/web/public/. Translate to the on-disk write target.
function urlPathToDiskPath(urlPath: string): string {
  const trimmed = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
  return path.join(REPO_ROOT, "apps/web/public", trimmed);
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  limit: number,
  onComplete: () => void
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const task = tasks[idx];
      if (!task) return;
      try {
        await task();
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`task ${idx} failed: ${reason}`);
      } finally {
        onComplete();
      }
    }
  });
  await Promise.all(workers);
}

await main();
