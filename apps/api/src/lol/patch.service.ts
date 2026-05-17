import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type {
  ChampionPatchChangeGroup,
  ChampionPatchChangeKind,
  CurrentPatchChangesResponse,
  PatchListEntry,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { type ParsedChange, parsePatchWikitext } from "./patch-parser";

const DDRAGON_VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json";
const WIKI_API = "https://wiki.leagueoflegends.com/api.php";
// Wiki etiquette: identify the bot and provide a contact URL.
const USER_AGENT = "vyoh.gg/1.0 (+https://vyoh.gg) patch-notes-sync";

interface MediaWikiParseResponse {
  parse?: {
    title?: string;
    wikitext?: { "*"?: string };
  };
  error?: { code?: string; info?: string };
}

@Injectable()
export class PatchService {
  private readonly logger = new Logger(PatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Every 6h on the hour. Patch detection lag is bounded by this interval;
  // patches drop fortnightly so the cost is 4 cheap GETs/day with no parse
  // cost on no-change days.
  @Cron("0 */6 * * *")
  async cronTick(): Promise<void> {
    try {
      await this.syncIfNewPatch();
    } catch (err) {
      this.logger.error("Patch sync failed", err instanceof Error ? err.stack : err);
    }
  }

  // Public entry point: also called from `prisma/run-patch-sync.ts` for
  // manual smoke tests. Returns the version that was synced, or null when
  // already current.
  async syncIfNewPatch(): Promise<string | null> {
    const latest = await this.fetchLatestVersion();
    const truncated = truncateVersion(latest);
    const existing = await this.prisma.patchVersion.findUnique({
      where: { version: truncated },
    });
    if (existing) {
      this.logger.log(`Patch ${truncated} already recorded — nothing to do`);
      return null;
    }
    this.logger.log(`New patch detected: ${truncated} — fetching wikitext`);
    const wikitext = await this.fetchWikitext(truncated);
    const changes = parsePatchWikitext(wikitext);
    await this.persist(truncated, changes);
    this.logger.log(`Inserted ${changes.length} changes for patch ${truncated}`);
    return truncated;
  }

  private async fetchLatestVersion(): Promise<string> {
    const res = await fetch(DDRAGON_VERSIONS, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`ddragon versions HTTP ${res.status}`);
    const versions = (await res.json()) as string[];
    const first = versions[0];
    if (!first) throw new Error("ddragon versions response was empty");
    return first;
  }

  private async fetchWikitext(truncatedVersion: string): Promise<string> {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "parse");
    url.searchParams.set("page", wikiPageTitle(truncatedVersion));
    url.searchParams.set("prop", "wikitext");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "1");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`wiki parse HTTP ${res.status}`);
    const body = (await res.json()) as MediaWikiParseResponse;
    if (body.error) {
      throw new Error(
        `wiki error ${body.error.code ?? "unknown"}: ${body.error.info ?? ""}`
      );
    }
    const text = body.parse?.wikitext?.["*"];
    if (!text)
      throw new Error(`wiki parse response had no wikitext for V${truncatedVersion}`);
    return text;
  }

  // Read-side query for the PN2 profile heads-up. Returns the most recently
  // *fetched* patch (cron writes one row per detected version), filtered to
  // the caller-supplied wiki champion names. The caller is expected to have
  // already resolved Riot-internal aliases (e.g. "MonkeyKing") to wiki
  // display names (e.g. "Wukong") — the API matches `championKey` verbatim
  // against the stored wiki name.
  async getCurrentChanges(
    championKeys: readonly string[]
  ): Promise<CurrentPatchChangesResponse> {
    const latest = await this.prisma.patchVersion.findFirst({
      orderBy: { fetchedAt: "desc" },
    });
    if (!latest) return { patchVersion: null, changes: [] };
    if (championKeys.length === 0) {
      return { patchVersion: latest.version, changes: [] };
    }
    const rows = await this.prisma.championPatchChange.findMany({
      where: {
        patchVersion: latest.version,
        championKey: { in: [...championKeys] },
      },
      orderBy: [{ championKey: "asc" }, { id: "asc" }],
    });
    return {
      patchVersion: latest.version,
      changes: groupByChampion(rows),
    };
  }

  // PN3 patch-selector source. `fetchedAt` desc mirrors getCurrentChanges'
  // notion of "current" — both index off the same column so what shows as
  // first in the dropdown is exactly what the heads-up surfaces.
  async listPatches(limit = 10): Promise<PatchListEntry[]> {
    const rows = await this.prisma.patchVersion.findMany({
      orderBy: { fetchedAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      version: r.version,
      patchDate: r.patchDate ? r.patchDate.toISOString() : null,
      fetchedAt: r.fetchedAt.toISOString(),
    }));
  }

  // PN3 read-side for the patch-notes tab. Unlike `getCurrentChanges`, this
  // returns the entire patch's changes — no champion filter, no IN-clause
  // cap — because the tab renders the full slate and sorts client-side by
  // the caller's play count. Returns a null version when the requested
  // patch isn't synced (treat as "unknown patch" on the client).
  async getChangesForVersion(version: string): Promise<CurrentPatchChangesResponse> {
    const found = await this.prisma.patchVersion.findUnique({ where: { version } });
    if (!found) return { patchVersion: null, changes: [] };
    const rows = await this.prisma.championPatchChange.findMany({
      where: { patchVersion: version },
      orderBy: [{ championKey: "asc" }, { id: "asc" }],
    });
    return { patchVersion: version, changes: groupByChampion(rows) };
  }

  // Atomic upsert: insert the PatchVersion row and all change rows in a
  // single transaction. Pre-deletes any pre-existing changes for the
  // version so manual re-runs after a parser bugfix stay idempotent.
  private async persist(version: string, changes: ParsedChange[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.championPatchChange.deleteMany({ where: { patchVersion: version } }),
      this.prisma.patchVersion.upsert({
        where: { version },
        create: { version },
        update: {},
      }),
      this.prisma.championPatchChange.createMany({
        data: changes.map((c) => ({
          patchVersion: version,
          championKey: c.champion,
          ability: c.ability,
          changeText: c.changeText,
          changeType: c.changeType,
        })),
      }),
    ]);
  }
}

// Group raw change rows by champion, preserving DB order (already
// championKey ASC, id ASC). The `changeType` cast is safe: it's only ever
// written by the parser using the ChampionPatchChangeKind union or null.
function groupByChampion(
  rows: ReadonlyArray<{
    championKey: string;
    ability: string | null;
    changeText: string;
    changeType: string | null;
  }>
): ChampionPatchChangeGroup[] {
  const groups = new Map<string, ChampionPatchChangeGroup>();
  for (const row of rows) {
    let group = groups.get(row.championKey);
    if (!group) {
      group = { champion: row.championKey, changes: [] };
      groups.set(row.championKey, group);
    }
    group.changes.push({
      ability: row.ability,
      changeText: row.changeText,
      changeType: row.changeType as ChampionPatchChangeKind | null,
    });
  }
  return [...groups.values()];
}

// ddragon returns "16.10.1" — Riot's API still uses the legacy season major
// (season 16 = 2026), but the user-facing patch label and the wiki page name
// are year-based (V26.10). Same +10 transform as the web side; see
// apps/web/src/lol/_shared/patch/patch-version.ts for the canonical impl.
// Guard against a future Riot switch to year-based: pass through if major
// already looks year-shaped (>= 20).
export function truncateVersion(full: string): string {
  const parts = full.split(".");
  if (parts.length < 2) return full;
  const [rawMajor, minor] = parts;
  if (!rawMajor || !minor) return full;
  const majorNum = Number(rawMajor);
  if (!Number.isFinite(majorNum)) return full;
  const displayMajor = majorNum >= 20 ? majorNum : majorNum + 10;
  return `${displayMajor}.${minor}`;
}

// Wiki page titles zero-pad the minor (V26.09, V26.10). Storage version
// stays unpadded ("26.9") to match the web-side truncatePatch output.
export function wikiPageTitle(truncatedVersion: string): string {
  const [major, minor] = truncatedVersion.split(".");
  if (!major || !minor) return `V${truncatedVersion}`;
  const padded = minor.length === 1 ? `0${minor}` : minor;
  return `V${major}.${padded}`;
}
