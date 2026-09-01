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
import type { SyncJobTriggerResult } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SYNC_JOBS } from "../sync-jobs/sync-jobs.catalog";
import { type ParsedChange, parsePatchWikitext, parseReleaseDate } from "./patch-parser";

const JOB = "lol-patch-notes";

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

interface WikiModuleResponse {
  query?: {
    pages?: Record<
      string,
      { revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }
    >;
  };
}

@Injectable()
export class PatchService {
  private readonly logger = new Logger(PatchService.name);

  // The wiki hosts ranked emblems at `Season_YYYY_-_<Tier>.png`. Riot has not
  // redesigned the set since 2023, so that year is the *current* canonical
  // art — not a legacy fallback. The resolver below probes the wiki on demand
  // so a future redesign is picked up without a code change. Cached in-memory
  // for the process lifetime (TTL guard) to keep the wiki HEAD load to ~one
  // request per worker per day.
  private cachedEmblemYear: number | null = null;
  private cachedEmblemYearAt = 0;
  private static readonly EMBLEM_YEAR_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly EMBLEM_YEAR_FALLBACK = 2023;
  private static readonly EMBLEM_YEAR_LOOKBACK = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: SyncJobRegistry
  ) {}

  // Every 6h on the hour. Patch detection lag is bounded by this interval;
  // patches drop fortnightly so the cost is 4 cheap GETs/day with no parse
  // cost on no-change days.
  @Cron(SYNC_JOBS[JOB].cron, { name: JOB })
  async cronTick(): Promise<void> {
    await this.jobs.run(JOB, () => this.syncIfNewPatch());
  }

  // Owner-triggered from the status board, for the interval between a patch
  // going live and the next six-hourly tick noticing.
  triggerSync(): SyncJobTriggerResult {
    return this.jobs.trigger(JOB, () => this.syncIfNewPatch());
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
    return this.syncVersion(truncated, latest);
  }

  // Force-sync a specific truncated version (e.g. "26.9"). Used by the
  // backfill path in `run-patch-sync.ts` after the caller has filtered out
  // versions already in the DB. Idempotent via `persist`'s pre-delete, so
  // re-running after a parser bugfix is safe.
  async syncVersion(
    truncatedVersion: string,
    fullDdragonVersion?: string
  ): Promise<string> {
    const wikitext = await this.fetchWikitext(truncatedVersion);
    const changes = parsePatchWikitext(wikitext);
    const patchDate = parseReleaseDate(wikitext);
    if (fullDdragonVersion) {
      const championNames = new Set(
        changes.filter((c) => c.section === "champion").map((c) => c.subject)
      );
      if (championNames.size > 0) {
        try {
          const slotMaps = await this.fetchChampionSlotMaps(championNames);
          for (const change of changes) {
            if (
              change.section !== "champion" ||
              !change.ability ||
              change.ability === "Base"
            )
              continue;
            const slotMap = slotMaps.get(change.subject);
            const resolvedSlot =
              slotMap?.get(change.ability) ??
              slotMap?.get(change.ability.replace(/ \d+$/, "")) ??
              null;
            change.slot = resolvedSlot;
          }
        } catch (err) {
          this.logger.warn(
            `Champion ability data lookup failed for ${truncatedVersion} — ability names stored verbatim`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
    await this.persist(truncatedVersion, changes, patchDate);
    this.logger.log(`Inserted ${changes.length} changes for patch ${truncatedVersion}`);
    return truncatedVersion;
  }

  // Returns the latest year for which the wiki hosts a ranked emblem set,
  // walking backwards from the current year. Cached for 24h to keep wiki
  // HEAD load bounded. Falls back to the known-good 2023 set if every probe
  // fails (offline dev, wiki outage) so the UI never renders broken images.
  async getRankedEmblemYear(): Promise<number> {
    const now = Date.now();
    if (
      this.cachedEmblemYear !== null &&
      now - this.cachedEmblemYearAt < PatchService.EMBLEM_YEAR_TTL_MS
    ) {
      return this.cachedEmblemYear;
    }
    const currentYear = new Date().getUTCFullYear();
    for (let y = currentYear; y >= currentYear - PatchService.EMBLEM_YEAR_LOOKBACK; y--) {
      const url = `https://wiki.leagueoflegends.com/en-us/images/Season_${y}_-_Diamond.png`;
      try {
        const res = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": USER_AGENT },
        });
        if (res.ok) {
          this.cachedEmblemYear = y;
          this.cachedEmblemYearAt = now;
          return y;
        }
      } catch {
        // ignore network errors and try the next year
      }
    }
    this.cachedEmblemYear = PatchService.EMBLEM_YEAR_FALLBACK;
    this.cachedEmblemYearAt = now;
    return PatchService.EMBLEM_YEAR_FALLBACK;
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
    const { championIds, abilityIndexes } = await this.resolveChampionIdentities(rows);
    return {
      patchVersion: latest.version,
      changes: groupChampionRows(rows, championIds, abilityIndexes),
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
    const [{ championIds, abilityIndexes }, itemIds, perkIds] = await Promise.all([
      this.resolveChampionIdentities(champions),
      this.resolveEntityIds("item", items),
      this.resolveEntityIds("rune", runes),
    ]);
    return {
      patchVersion: version,
      champions: groupChampionRows(champions, championIds, abilityIndexes),
      items: groupEntryRows(items, itemIds),
      runes: groupEntryRows(runes, perkIds),
    };
  }

  // Resolves the wire-side identity columns for champion-section rows:
  // wiki subject → LolChampion.id, plus (championId, slot, ability name) →
  // LolChampionAbility.abilityIndex. Both lookups miss silently — a brand-new
  // champion or a renamed ability resolves to null and the web renders no
  // icon rather than a broken one.
  private async resolveChampionIdentities(
    rows: ReadonlyArray<{ subject: string; ability: string | null; slot: string | null }>
  ): Promise<{
    championIds: Map<string, number>;
    abilityIndexes: Map<string, number>;
  }> {
    const subjects = new Set<string>();
    for (const row of rows) subjects.add(row.subject);
    const championIds = new Map<string, number>();
    if (subjects.size === 0) return { championIds, abilityIndexes: new Map() };
    const champions = await this.prisma.lolChampion.findMany({
      where: { name: { in: [...subjects] } },
      select: { id: true, name: true },
    });
    for (const c of champions) championIds.set(c.name, c.id);

    const championIdList = champions.map((c) => c.id);
    const abilityIndexes = new Map<string, number>();
    if (championIdList.length === 0) return { championIds, abilityIndexes };
    const abilityRows = await this.prisma.lolChampionAbility.findMany({
      where: { championId: { in: championIdList } },
      select: { championId: true, slot: true, name: true, abilityIndex: true },
    });
    for (const a of abilityRows) {
      abilityIndexes.set(abilityKey(a.championId, a.slot, a.name), a.abilityIndex);
    }
    return { championIds, abilityIndexes };
  }

  // Resolves wiki subject → LolItem.id / LolPerk.id by name. Misses go
  // unrecorded — the wire's `entityId` stays null and the web renders no
  // icon. Distinct names only, batched into one IN-clause.
  private async resolveEntityIds(
    kind: "item" | "rune",
    rows: ReadonlyArray<{ subject: string }>
  ): Promise<Map<string, number>> {
    const subjects = new Set<string>();
    for (const row of rows) subjects.add(row.subject);
    const ids = new Map<string, number>();
    if (subjects.size === 0) return ids;
    const list =
      kind === "item"
        ? await this.prisma.lolItem.findMany({
            where: { name: { in: [...subjects] } },
            select: { id: true, name: true },
          })
        : await this.prisma.lolPerk.findMany({
            where: { name: { in: [...subjects] } },
            select: { id: true, name: true },
          });
    for (const r of list) ids.set(r.name, r.id);
    return ids;
  }

  // Fetches the wiki's canonical champion skill module (one request, all
  // champions) and returns slot maps (ability name → slot) keyed by wiki
  // champion display name.
  //
  // The wiki module has every named ability variant under skill_q/w/e/r/i,
  // including empowered forms (Karma's "Renewal" under skill_w, Lee Sin's
  // "Iron Will" under skill_w, etc.) — this is the canonical source the patch
  // notes themselves come from. No heuristics needed.
  private async fetchChampionSlotMaps(
    championNames: ReadonlySet<string>
  ): Promise<Map<string, Map<string, string>>> {
    const res = await fetch(
      `${WIKI_API}?action=query&titles=Module:ChampionData/data&prop=revisions&rvprop=content&rvslots=main&format=json`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!res.ok) throw new Error(`wiki champion module HTTP ${res.status}`);
    const body = (await res.json()) as WikiModuleResponse;
    const page = Object.values(body.query?.pages ?? {})[0];
    const skillModule = page?.revisions?.[0]?.slots?.main?.["*"] ?? "";

    const wikiSlots = parseChampionSkillModule(skillModule);
    const slotMaps = new Map<string, Map<string, string>>();
    for (const displayName of championNames) {
      const slotMap = wikiSlots.get(displayName);
      if (slotMap) slotMaps.set(displayName, slotMap);
    }
    return slotMaps;
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
          slot: c.slot ?? null,
          // iconPath column is legacy — we now resolve identity → URL at
          // read time (championId / abilityIndex / itemId / perkId). Left
          // null on every new write; safe to drop in a future migration.
          iconPath: null,
          changeText: c.changeText,
          changeType: c.changeType,
        })),
      }),
    ]);
  }
}

// Composite key for the `(championId, slot, ability name) → abilityIndex`
// lookup map. Slot can be null when the wiki module didn't carry the variant
// (rare; resolves to a null abilityIndex which the web treats as "no icon").
function abilityKey(championId: number, slot: string | null, name: string): string {
  return `${championId} ${slot ?? ""} ${name}`;
}

// Group raw champion-section rows by subject (wiki champion name),
// preserving DB order (already subject ASC, id ASC). `championIds` and
// `abilityIndexes` are pre-resolved by `resolveChampionIdentities`. The
// `changeType` cast is safe: it's only ever written by the parser using the
// ChampionPatchChangeKind union or null.
function groupChampionRows(
  rows: ReadonlyArray<{
    subject: string;
    ability: string | null;
    slot: string | null;
    changeText: string;
    changeType: string | null;
  }>,
  championIds: ReadonlyMap<string, number>,
  abilityIndexes: ReadonlyMap<string, number>
): ChampionPatchChangeGroup[] {
  const groups = new Map<string, ChampionPatchChangeGroup>();
  for (const row of rows) {
    let group = groups.get(row.subject);
    if (!group) {
      group = {
        champion: row.subject,
        championId: championIds.get(row.subject) ?? null,
        changes: [],
      };
      groups.set(row.subject, group);
    }
    const championId = group.championId;
    const abilityIndex =
      championId !== null && row.ability && row.ability !== "Base"
        ? (abilityIndexes.get(abilityKey(championId, row.slot, row.ability)) ?? null)
        : null;
    group.changes.push({
      ability: row.ability,
      slot: row.slot,
      abilityIndex,
      changeText: row.changeText,
      changeType: row.changeType as ChampionPatchChangeKind | null,
    });
  }
  return [...groups.values()];
}

// Group item/rune rows by subject. No ability layer — items and runes are
// flat, so each row turns into one PatchEntryChangeLine. `entityIds` is
// pre-resolved by `resolveEntityIds`.
function groupEntryRows(
  rows: ReadonlyArray<{
    subject: string;
    changeText: string;
    changeType: string | null;
  }>,
  entityIds: ReadonlyMap<string, number>
): PatchEntryChangeGroup[] {
  const groups = new Map<string, PatchEntryChangeGroup>();
  for (const row of rows) {
    let group = groups.get(row.subject);
    if (!group) {
      group = {
        name: row.subject,
        entityId: entityIds.get(row.subject) ?? null,
        changes: [],
      };
      groups.set(row.subject, group);
    }
    group.changes.push({
      changeText: row.changeText,
      changeType: row.changeType as ChampionPatchChangeKind | null,
    });
  }
  return [...groups.values()];
}

// Parses the wiki's Module:ChampionData/data Lua table into a map of
// championName → (abilityName → slot). Each skill_x key in the Lua table
// maps to a slot: i=Passive, q=Q, w=W, e=E, r=R. Every named variant is
// listed (e.g. Karma's skill_w has both "Focused Resolve" and "Renewal").
// Top-level champion blocks are identified by the 2-space indent of the Lua
// return table; nested sub-tables use deeper indentation so they're skipped.
function parseChampionSkillModule(lua: string): Map<string, Map<string, string>> {
  const SLOT: Record<string, string> = { i: "Passive", q: "Q", w: "W", e: "E", r: "R" };
  const result = new Map<string, Map<string, string>>();

  // Split on top-level entries (2-space indent): `  ["ChampionName"] = {`
  for (const block of lua.split(/\n {2}\["/)) {
    const nameEnd = block.indexOf('"');
    if (nameEnd < 0) continue;
    const champName = block.slice(0, nameEnd);

    const slotMap = new Map<string, string>();
    for (const m of block.matchAll(/\["skill_([iqwer])"\]\s*=\s*\{([^}]+)\}/g)) {
      const slotKey = m[1];
      const names = m[2];
      if (!slotKey || !names) continue;
      const slot = SLOT[slotKey];
      if (!slot) continue;
      for (const n of names.matchAll(/\[\d+\]\s*=\s*"([^"]+)"/g)) {
        const name = n[1];
        if (name) slotMap.set(name, slot);
      }
    }

    if (slotMap.size > 0) result.set(champName, slotMap);
  }

  return result;
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
