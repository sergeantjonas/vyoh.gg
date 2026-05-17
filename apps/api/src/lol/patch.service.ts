import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type {
  ChampionPatchChangeGroup,
  ChampionPatchChangeKind,
  CurrentPatchChangesResponse,
  PatchChangesResponse,
  PatchEntryChangeGroup,
  PatchListEntry,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { type ParsedChange, parsePatchWikitext, parseReleaseDate } from "./patch-parser";

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
    return this.syncVersion(truncated);
  }

  // Force-sync a specific truncated version (e.g. "26.9"). Used by the
  // backfill path in `run-patch-sync.ts` after the caller has filtered out
  // versions already in the DB. Idempotent via `persist`'s pre-delete, so
  // re-running after a parser bugfix is safe.
  async syncVersion(truncatedVersion: string): Promise<string> {
    const wikitext = await this.fetchWikitext(truncatedVersion);
    const changes = parsePatchWikitext(wikitext);
    const patchDate = parseReleaseDate(wikitext);
    await this.persist(truncatedVersion, changes, patchDate);
    this.logger.log(`Inserted ${changes.length} changes for patch ${truncatedVersion}`);
    return truncatedVersion;
  }

  // Full ddragon versions list (newest-first). Exposed for the backfill
  // script — head-only callers should keep using `syncIfNewPatch`.
  async fetchVersionList(): Promise<string[]> {
    const res = await fetch(DDRAGON_VERSIONS, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`ddragon versions HTTP ${res.status}`);
    const versions = (await res.json()) as string[];
    if (versions.length === 0) throw new Error("ddragon versions response was empty");
    return versions;
  }

  private async fetchLatestVersion(): Promise<string> {
    const versions = await this.fetchVersionList();
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
  // display names (e.g. "Wukong") — the API matches `subject` verbatim
  // against the stored wiki name. Champion-only by design — items and runes
  // never bleed into this surface.
  async getCurrentChanges(
    championKeys: readonly string[]
  ): Promise<CurrentPatchChangesResponse> {
    const latest = await this.prisma.patchVersion.findFirst({
      orderBy: [{ patchDate: { sort: "desc", nulls: "last" } }, { version: "desc" }],
    });
    if (!latest) return { patchVersion: null, changes: [] };
    if (championKeys.length === 0) {
      return { patchVersion: latest.version, changes: [] };
    }
    const rows = await this.prisma.patchChange.findMany({
      where: {
        patchVersion: latest.version,
        section: "champion",
        subject: { in: [...championKeys] },
      },
      orderBy: [{ subject: "asc" }, { id: "asc" }],
    });
    return {
      patchVersion: latest.version,
      changes: groupChampionRows(rows),
    };
  }

  // PN3 patch-selector source. Both `listPatches` and `getCurrentChanges` use
  // patchDate desc (nulls last) + version desc as a tiebreaker so the current
  // patch is always whichever has the most-recent release date.
  async listPatches(limit = 10): Promise<PatchListEntry[]> {
    const rows = await this.prisma.patchVersion.findMany({
      orderBy: [{ patchDate: { sort: "desc", nulls: "last" } }, { version: "desc" }],
      take: limit,
    });
    return rows.map((r) => ({
      version: r.version,
      patchDate: r.patchDate ? r.patchDate.toISOString() : null,
      fetchedAt: r.fetchedAt.toISOString(),
    }));
  }

  // PN3 read-side for the patch-notes tab. Unlike `getCurrentChanges`, this
  // returns the entire patch's changes — no subject filter, no IN-clause
  // cap — because the tab renders the full slate and sorts client-side by
  // the caller's play count. PN4: rows from all three sections are returned,
  // partitioned by `section` so the UI can render champions / items / runes
  // as separate blocks. Returns a null version when the requested patch
  // isn't synced (treat as "unknown patch" on the client).
  async getChangesForVersion(version: string): Promise<PatchChangesResponse> {
    const found = await this.prisma.patchVersion.findUnique({ where: { version } });
    if (!found) {
      return { patchVersion: null, champions: [], items: [], runes: [] };
    }
    const rows = await this.prisma.patchChange.findMany({
      where: { patchVersion: version },
      orderBy: [{ section: "asc" }, { subject: "asc" }, { id: "asc" }],
    });
    const champions: typeof rows = [];
    const items: typeof rows = [];
    const runes: typeof rows = [];
    for (const row of rows) {
      if (row.section === "champion") champions.push(row);
      else if (row.section === "item") items.push(row);
      else if (row.section === "rune") runes.push(row);
    }
    return {
      patchVersion: version,
      champions: groupChampionRows(champions),
      items: groupEntryRows(items),
      runes: groupEntryRows(runes),
    };
  }

  // Atomic upsert: insert the PatchVersion row and all change rows in a
  // single transaction. Pre-deletes any pre-existing changes for the
  // version so manual re-runs after a parser bugfix stay idempotent.
  private async persist(
    version: string,
    changes: ParsedChange[],
    patchDate: Date | null
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.patchChange.deleteMany({ where: { patchVersion: version } }),
      this.prisma.patchVersion.upsert({
        where: { version },
        create: { version, patchDate },
        update: { patchDate },
      }),
      this.prisma.patchChange.createMany({
        data: changes.map((c) => ({
          patchVersion: version,
          section: c.section,
          subject: c.subject,
          ability: c.ability,
          changeText: c.changeText,
          changeType: c.changeType,
        })),
      }),
    ]);
  }
}

// Group raw champion-section rows by subject (wiki champion name),
// preserving DB order (already subject ASC, id ASC). The `changeType` cast
// is safe: it's only ever written by the parser using the
// ChampionPatchChangeKind union or null.
function groupChampionRows(
  rows: ReadonlyArray<{
    subject: string;
    ability: string | null;
    changeText: string;
    changeType: string | null;
  }>
): ChampionPatchChangeGroup[] {
  const groups = new Map<string, ChampionPatchChangeGroup>();
  for (const row of rows) {
    let group = groups.get(row.subject);
    if (!group) {
      group = { champion: row.subject, changes: [] };
      groups.set(row.subject, group);
    }
    group.changes.push({
      ability: row.ability,
      changeText: row.changeText,
      changeType: row.changeType as ChampionPatchChangeKind | null,
    });
  }
  return [...groups.values()];
}

// Group item/rune rows by subject. No ability layer — items and runes are
// flat, so each row turns into one PatchEntryChangeLine.
function groupEntryRows(
  rows: ReadonlyArray<{
    subject: string;
    changeText: string;
    changeType: string | null;
  }>
): PatchEntryChangeGroup[] {
  const groups = new Map<string, PatchEntryChangeGroup>();
  for (const row of rows) {
    let group = groups.get(row.subject);
    if (!group) {
      group = { name: row.subject, changes: [] };
      groups.set(row.subject, group);
    }
    group.changes.push({
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
