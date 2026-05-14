#!/usr/bin/env tsx
// Build-time prefetch for Steam capsule art (owned + wishlist).
//
// Mirrors the design of refresh-lol-assets.mts but with one variant per appid
// (capsule_231x87). Source list is fetched live from Steam — no DB coupling.
// See docs/working-notes/steam-integration.md.
//
// Modes:
//   pnpm refresh:steam-assets               incremental
//   pnpm refresh:steam-assets -- --full     re-fetch everything
//
// Produces:
//   apps/web/public/steam/manifest.json        — script-internal: paths + hash + bytes
//   apps/web/src/steam/_shared/manifest.gen.ts — slim runtime presence mirror
//   apps/web/public/steam/apps/<appid>/capsule.webp

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Reuse the API's env file so STEAM_API_KEY isn't duplicated. The script is
// a sibling concern — it talks to Steam directly, just like the API does.
process.loadEnvFile(path.join(REPO_ROOT, "apps/api/.env"));

const PUBLIC_STEAM = path.join(REPO_ROOT, "apps/web/public/steam");
const SRC_STEAM_SHARED = path.join(REPO_ROOT, "apps/web/src/steam/_shared");
const CACHE_DIR = path.join(REPO_ROOT, ".cache/steam-images");
const MANIFEST_PATH = path.join(PUBLIC_STEAM, "manifest.json");
const RUNTIME_MANIFEST_PATH = path.join(SRC_STEAM_SHARED, "manifest.gen.ts");
const SCHEMA_VERSION = 1;

// SteamID64 of the integration owner. Public via the profile URL; kept here so
// the script doesn't need to import from the api workspace. Mirrors
// apps/api/src/steam/steam.config.ts.
const STEAM_OWNER_ID = "76561198020053778";
const STEAM_API_BASE = "https://api.steampowered.com";
const STEAM_CDN_BASE =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

const FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY_MS = 5_000;
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;
// Steam routinely 404s on capsules for DLC/soundtrack/delisted titles. A
// looser threshold than LoL (5%) avoids spurious structural-failure exits.
const MISSING_THRESHOLD = 0.15;

interface ManifestAsset {
  path: string;
  hash: string;
  bytes: number;
}

interface MissingEntry {
  appid: number;
  reason: string;
}

interface Manifest {
  schemaVersion: number;
  generatedAt: string;
  capsules: Record<string, ManifestAsset>;
  missing: MissingEntry[];
}

interface SteamOwnedGameRaw {
  appid: number;
  name: string;
}

interface SteamWishlistItemRaw {
  appid: number;
}

const argv = new Set(process.argv.slice(2));
const MODE: "default" | "full" = argv.has("--full") ? "full" : "default";

async function main(): Promise<void> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    throw new Error("STEAM_API_KEY missing — check apps/api/.env");
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(PUBLIC_STEAM, { recursive: true });
  await mkdir(path.join(PUBLIC_STEAM, "apps"), { recursive: true });
  await mkdir(SRC_STEAM_SHARED, { recursive: true });

  const prevManifest = await readManifest();

  console.log("fetching owned + wishlist appids from Steam…");
  const owned = await fetchOwnedAppids(apiKey);
  const wishlist = await fetchWishlistAppids(apiKey);
  const appids = Array.from(new Set([...owned, ...wishlist])).sort((a, b) => a - b);
  console.log(
    `  owned=${owned.length} wishlist=${wishlist.length} unique=${appids.length}`
  );

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    capsules: {},
    missing: [],
  };

  let attempted = 0;
  const tasks = appids.map((appid) => async () => {
    attempted++;
    const prev = prevManifest?.capsules[String(appid)];
    const result = await processCapsule({ appid, prev });
    if (result.asset) manifest.capsules[String(appid)] = result.asset;
    if (result.missing) manifest.missing.push(result.missing);
    if (attempted % 25 === 0) {
      process.stderr.write(`  capsules: ${attempted}/${tasks.length}\n`);
    }
  });
  await runWithConcurrency(tasks, CONCURRENCY);

  const succeeded = Object.keys(manifest.capsules).length;
  const missingCount = manifest.missing.length;
  console.log(
    `capsules: refreshed ${succeeded}/${appids.length} (missing ${missingCount})`
  );

  if (appids.length > 0 && missingCount / appids.length > MISSING_THRESHOLD) {
    console.error(
      `missing/attempted ratio ${(missingCount / appids.length).toFixed(3)} > ${MISSING_THRESHOLD}; structural failure?`
    );
    process.exit(1);
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeRuntimeManifest(manifest);
  await assertManifestFiles(manifest);

  console.log(`wrote ${MANIFEST_PATH}`);
  console.log(`wrote ${RUNTIME_MANIFEST_PATH}`);
}

interface ProcessCapsuleOptions {
  appid: number;
  prev: ManifestAsset | undefined;
}

interface ProcessCapsuleResult {
  asset?: ManifestAsset;
  missing?: MissingEntry;
}

async function processCapsule(
  opts: ProcessCapsuleOptions
): Promise<ProcessCapsuleResult> {
  const { appid, prev } = opts;
  const outRel = `/steam/apps/${appid}/capsule.webp`;
  const outAbs = urlPathToDiskPath(outRel);
  if (MODE === "default" && prev && (await fileExists(outAbs))) {
    return { asset: prev };
  }
  // Try unversioned CDN paths first (fast, no extra API call). Steam serves
  // capsule_231x87 for fleshed-out titles; coming-soon entries often only
  // have header.jpg / library_600x900 / library_hero at the unversioned URL.
  const unversioned = [
    `${STEAM_CDN_BASE}/${appid}/capsule_231x87.jpg`,
    `${STEAM_CDN_BASE}/${appid}/header.jpg`,
    `${STEAM_CDN_BASE}/${appid}/library_600x900.jpg`,
    `${STEAM_CDN_BASE}/${appid}/library_hero.jpg`,
  ];
  let lastReason = "no sources tried";
  for (const src of unversioned) {
    try {
      const bytes = await transformWebp(await fetchBinary(src));
      await mkdir(path.dirname(outAbs), { recursive: true });
      await writeFile(outAbs, bytes);
      return { asset: { path: outRel, hash: sha256(bytes), bytes: bytes.length } };
    } catch (err) {
      lastReason = err instanceof Error ? err.message : String(err);
    }
  }
  // Versioned fallback: the storefront API (`appdetails`) returns the
  // content-hashed URL Steam uses for upcoming titles whose assets aren't
  // mirrored to the unversioned path yet. One extra request per miss only.
  try {
    const versioned = await fetchVersionedCapsuleUrls(appid);
    for (const src of versioned) {
      try {
        const bytes = await transformWebp(await fetchBinary(src));
        await mkdir(path.dirname(outAbs), { recursive: true });
        await writeFile(outAbs, bytes);
        return { asset: { path: outRel, hash: sha256(bytes), bytes: bytes.length } };
      } catch (err) {
        lastReason = err instanceof Error ? err.message : String(err);
      }
    }
  } catch (err) {
    lastReason = err instanceof Error ? err.message : String(err);
  }
  return { missing: { appid, reason: lastReason } };
}

// Hits the store appdetails endpoint and returns the versioned capsule/header
// URLs Steam advertises for this appid. Order matches our preferred crop
// (capsule_231x87 → header.jpg). Throws if the request fails or the appid is
// not exposed via the store (region-locked, unlisted).
async function fetchVersionedCapsuleUrls(appid: number): Promise<string[]> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`;
  const res = await fetchWithRetry(url);
  const body = (await res.json()) as Record<
    string,
    {
      success: boolean;
      data?: { capsule_image?: string; header_image?: string };
    }
  >;
  const entry = body[String(appid)];
  if (!entry?.success || !entry.data) {
    throw new Error(`appdetails returned success=false for ${appid}`);
  }
  const out: string[] = [];
  if (entry.data.capsule_image) out.push(entry.data.capsule_image);
  if (entry.data.header_image) out.push(entry.data.header_image);
  return out;
}

async function fetchOwnedAppids(apiKey: string): Promise<number[]> {
  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}&steamid=${STEAM_OWNER_ID}&include_appinfo=0&include_played_free_games=1`;
  const data = (await fetchJson(url)) as {
    response: { games?: SteamOwnedGameRaw[] };
  };
  return (data.response.games ?? []).map((g) => g.appid);
}

async function fetchWishlistAppids(apiKey: string): Promise<number[]> {
  const url = `${STEAM_API_BASE}/IWishlistService/GetWishlist/v1/?key=${encodeURIComponent(apiKey)}&steamid=${STEAM_OWNER_ID}`;
  const data = (await fetchJson(url)) as {
    response: { items?: SteamWishlistItemRaw[] };
  };
  return (data.response.items ?? []).map((i) => i.appid);
}

// Normalize every source variant (capsule_231x87 native, header.jpg 460×215,
// library_600x900.jpg vertical) to the canonical 231×87 cover crop so the
// bundle has a single aspect ratio. Cache by source-bytes hash so re-fetching
// is cheap when only the appid set changes.
const CAPSULE_W = 231;
const CAPSULE_H = 87;

async function transformWebp(input: Buffer): Promise<Buffer> {
  const cacheKey = sha256(
    Buffer.concat([input, Buffer.from(`steam-capsule-${CAPSULE_W}x${CAPSULE_H}-q85`)])
  );
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.webp`);
  try {
    return await readFile(cachePath);
  } catch {
    // miss
  }
  const out = await sharp(input)
    .resize({ width: CAPSULE_W, height: CAPSULE_H, fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
  await writeFile(cachePath, out);
  return out;
}

async function writeRuntimeManifest(manifest: Manifest): Promise<void> {
  const appids = Object.keys(manifest.capsules)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const entries = appids.map((id) => `  ${id},`).join("\n");
  const out = `// AUTO-GENERATED by scripts/refresh-steam-assets.mts. Do not edit.
// Slim presence-only mirror of public/steam/manifest.json. The full JSON
// stays in public/ for diffing; this set is what the runtime imports.

export const steamCapsuleAppids: ReadonlySet<number> = new Set([
${entries}
]);
`;
  await writeFile(RUNTIME_MANIFEST_PATH, out);
}

async function assertManifestFiles(manifest: Manifest): Promise<void> {
  for (const [appid, asset] of Object.entries(manifest.capsules)) {
    const filePath = urlPathToDiskPath(asset.path);
    try {
      await stat(filePath);
    } catch {
      throw new Error(
        `manifest references missing file: capsule:${appid} -> ${filePath}`
      );
    }
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

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchWithRetry(url);
  return res.json();
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
        // 404 is terminal: capsule doesn't exist for this appid (DLC/soundtrack).
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
  limit: number
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
      }
    }
  });
  await Promise.all(workers);
}

await main();
