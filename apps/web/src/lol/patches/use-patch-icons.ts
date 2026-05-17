import { useQuery } from "@tanstack/react-query";

const CDRAGON_GAME_DATA =
  "https://raw.communitydragon.org/{v}/plugins/rcp-be-lol-game-data/global/default";

// LoL display version "26.9" → CDragon "16.9"
// Reverses the +10 offset from patch-version.ts: displayMajor = apiMajor + 10
function lolToCDragonVersion(lolPatch: string): string {
  const [major, minor] = lolPatch.split(".");
  return `${Number(major) - 10}.${minor}`;
}

// "16.9" → "16.8"; "16.1" → "16.0". If CDragon doesn't have that snapshot,
// fetchVersionIcons returns null and the fallback maps are simply empty.
function prevCDragonVersion(v: string): string {
  const [maj, min = 1] = v.split(".").map(Number);
  return `${maj}.${Math.max(0, min - 1)}`;
}

function cdragonBase(cdragonVersion: string): string {
  return CDRAGON_GAME_DATA.replace("{v}", cdragonVersion);
}

function cdragonIconUrl(iconPath: string, cdragonVersion: string): string {
  const relative = iconPath
    .replace("/lol-game-data/assets/", "/")
    .toLowerCase();
  return `${cdragonBase(cdragonVersion)}${relative}`;
}

interface RawPerk {
  id: number;
  iconPath: string;
  name: string;
}

interface RawItem {
  id: number;
  name: string;
  iconPath: string;
}

export interface PatchIconMaps {
  itemIconByName: Map<string, string>;
  runeIconByName: Map<string, string>;
}

async function fetchVersionIcons(cdragonVersion: string): Promise<PatchIconMaps | null> {
  const base = `${cdragonBase(cdragonVersion)}/v1`;
  const [perksRes, itemsRes] = await Promise.all([
    fetch(`${base}/perks.json`),
    fetch(`${base}/items.json`),
  ]);
  if (!perksRes.ok || !itemsRes.ok) return null;

  const perks: RawPerk[] = await perksRes.json();
  const items: RawItem[] = await itemsRes.json();

  const runeIconByName = new Map<string, string>();
  for (const p of perks) {
    if (p.name) runeIconByName.set(p.name, cdragonIconUrl(p.iconPath, cdragonVersion));
  }

  const itemIconByName = new Map<string, string>();
  for (const it of items) {
    if (it.name) itemIconByName.set(it.name, cdragonIconUrl(it.iconPath, cdragonVersion));
  }

  return { itemIconByName, runeIconByName };
}

async function fetchPatchIcons(cdragonVersion: string): Promise<PatchIconMaps> {
  const prev = prevCDragonVersion(cdragonVersion);
  const [current, previous] = await Promise.all([
    fetchVersionIcons(cdragonVersion),
    fetchVersionIcons(prev),
  ]);
  // Prev fills in gaps for entries removed in the current patch (e.g. Phase
  // Rush removed in 26.9 exists in 16.8 but not 16.9). Current takes
  // precedence for anything present in both.
  return {
    itemIconByName: new Map([
      ...(previous?.itemIconByName ?? []),
      ...(current?.itemIconByName ?? []),
    ]),
    runeIconByName: new Map([
      ...(previous?.runeIconByName ?? []),
      ...(current?.runeIconByName ?? []),
    ]),
  };
}

export function usePatchIcons(lolPatch: string | null): PatchIconMaps {
  const cdragonVersion = lolPatch ? lolToCDragonVersion(lolPatch) : null;
  const { data } = useQuery({
    queryKey: ["lol", "patch-icons", cdragonVersion],
    queryFn: () => fetchPatchIcons(cdragonVersion!),
    enabled: cdragonVersion !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ?? { itemIconByName: new Map(), runeIconByName: new Map() };
}
