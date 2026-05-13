// Bundle-inlined view of apps/web/public/lol/manifest.json. The manifest is
// produced by scripts/refresh-lol-assets.mts and intentionally imported
// directly (not fetched) — it's small (~250KB), and inlining it lets every
// URL helper resolve a bundled asset path synchronously without a network
// hop. See docs/working-notes/lol-image-pipeline.md Decision 3.
import manifestJson from "../../../public/lol/manifest.json";

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

interface Manifest {
  schemaVersion: number;
  patch: string;
  generatedAt: string;
  champions: Record<string, ChampionEntry>;
  items: Record<string, ManifestAsset>;
  runes: Record<string, ManifestAsset>;
  summonerSpells: Record<string, ManifestAsset>;
  roleIcons: Record<string, ManifestAsset>;
}

// The JSON's static type is a deeply-inferred literal — collapse to the
// nominal Manifest shape so consumers don't see 200+ champion keys in hover.
const manifest = manifestJson as Manifest;

export type ChampionVariant = "square" | "card" | "backdrop";

const SWARM_PREFIX = "Strawberry_";
export function normalizeChampionAlias(alias: string): string {
  return alias.startsWith(SWARM_PREFIX) ? alias.slice(SWARM_PREFIX.length) : alias;
}

export function getChampionAsset(
  alias: string,
  variant: ChampionVariant
): string | undefined {
  return manifest.champions[normalizeChampionAlias(alias)]?.[variant]?.path;
}

export function getItemAsset(id: number | string): string | undefined {
  return manifest.items[String(id)]?.path;
}

export function getRuneAsset(id: number | string): string | undefined {
  return manifest.runes[String(id)]?.path;
}

export function getSummonerSpellAsset(id: number | string): string | undefined {
  return manifest.summonerSpells[String(id)]?.path;
}

export function getRoleIconAsset(slug: string): string | undefined {
  return manifest.roleIcons[slug]?.path;
}

export const manifestPatch = manifest.patch;
