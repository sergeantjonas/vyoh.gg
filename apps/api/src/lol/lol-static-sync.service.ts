import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type {
  LolChampionAbilityDto,
  LolChampionDto,
  LolItemDto,
  LolPerkDto,
  LolStaticBundle,
  LolSummonerSpellDto,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  type ParsedItem,
  parseAbilityTemplate,
  parseChampionAbilityModule,
  parseItemDataModule,
} from "./lol-static-parsers";
import { truncateVersion } from "./patch.service";

// Wiki etiquette: identify the bot.
const USER_AGENT = "vyoh.gg/1.0 (+https://vyoh.gg) static-metadata-sync";
const WIKI_API = "https://wiki.leagueoflegends.com/api.php";
const DDRAGON_VERSIONS = "https://ddragon.leagueoflegends.com/api/versions.json";
const DDRAGON_CDN = "https://ddragon.leagueoflegends.com/cdn";

// A perkId can briefly disappear from DDragon between Riot ship + CDN
// propagation. Wait this many consecutive missing cycles before marking the
// row `retiredAt`. At the 6h cron cadence, 4 cycles ≈ 24h — long enough to
// outlast CDN blips, short enough that a real retirement (Phase Rush →
// Stormraider's Surge) is reflected within a day.
const MISSING_CYCLES_BEFORE_RETIRED = 4;

interface DdragonChampionListBody {
  data: Record<string, { key: string; name: string; tags: string[] }>;
}

interface DdragonSummonerSpellsBody {
  data: Record<string, { key: string; name: string; modes?: string[] }>;
}

interface DdragonRunePath {
  id: number;
  key: string;
  name: string;
  slots: Array<{ runes: Array<{ id: number; key: string; name: string }> }>;
}

type DdragonRunesReforged = DdragonRunePath[];

interface WikiModuleResponse {
  query?: {
    pages?: Record<
      string,
      { revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }
    >;
  };
}

@Injectable()
export class LolStaticSyncService {
  private readonly logger = new Logger(LolStaticSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs every 6h, offset 5 min from the patch-detection cron so the two
  // services don't hammer ddragon simultaneously. The wiki content sync is
  // unconditional — volunteer-edit lag is self-healing on every tick,
  // independent of whether a new patch was detected. See
  // docs/working-notes/lol/lol-static-metadata.md § Drift-tolerant two-source
  // sync.
  @Cron("5 */6 * * *")
  async cronTick(): Promise<void> {
    try {
      await this.syncAll();
    } catch (err) {
      this.logger.error("Static sync failed", err instanceof Error ? err.stack : err);
    }
  }

  // Manual entry point used by `prisma/run-static-sync.ts` and tests.
  // Resolves the current patch version from DDragon (rather than from the
  // PatchVersion table) so this service stays decoupled from the
  // patch-notes pipeline — if patch.service.ts hasn't run yet, static sync
  // still works.
  async syncAll(): Promise<{
    patchVersion: string;
    items: number;
    champions: number;
    abilityDescriptions: number;
    summonerSpells: number;
    perks: number;
  }> {
    const ddragonVersion = await this.fetchLatestDdragonVersion();
    const patchVersion = truncateVersion(ddragonVersion);

    // Run in series — wiki rate-limits sustained traffic at ~200/min and
    // the calls overlap on the same host. The bulk fetches above are well
    // under that; the per-ability description fetches below run ~170 pairs
    // (template + action=parse) per tick, ~57/hour, comfortably under.
    const items = await this.syncItems(patchVersion);
    const champions = await this.syncChampionsAndAbilities(ddragonVersion, patchVersion);
    const abilityDescriptions = await this.syncChampionAbilityDescriptions(patchVersion);
    const summonerSpells = await this.syncSummonerSpells(ddragonVersion);
    const perks = await this.syncPerks(ddragonVersion);

    this.logger.log(
      `Static sync ${patchVersion}: items=${items}, champions=${champions}, ` +
        `abilityDescriptions=${abilityDescriptions}, ` +
        `summonerSpells=${summonerSpells}, perks=${perks}`
    );

    return {
      patchVersion,
      items,
      champions,
      abilityDescriptions,
      summonerSpells,
      perks,
    };
  }

  async syncItems(patchVersion: string): Promise<number> {
    const lua = await this.fetchWikiModule("Module:ItemData/data");
    const parsed = parseItemDataModule(lua);
    if (parsed.length === 0) {
      this.logger.warn("Module:ItemData/data parsed to 0 items — skipping upsert");
      return 0;
    }
    const now = new Date();
    let written = 0;
    for (const item of parsed) {
      try {
        await this.upsertItem(item, patchVersion, now);
        written++;
      } catch (err) {
        this.logger.warn(
          `Item upsert failed for ${item.name} (${item.id})`,
          err instanceof Error ? err.message : err
        );
      }
    }
    return written;
  }

  private async upsertItem(
    item: ParsedItem,
    patchVersion: string,
    now: Date
  ): Promise<void> {
    const data = {
      name: item.name,
      tier: item.tier,
      itemType: item.itemType,
      priceTotal: item.priceTotal,
      recipe: item.recipe,
      categories: item.categories,
      stats: item.stats,
      descriptionWikitext: item.descriptionWikitext,
      iconWikiName: item.name,
      wikiSyncedAt: now,
      wikiSyncedPatchVersion: patchVersion,
    };
    await this.prisma.lolItem.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: data,
    });
  }

  async syncChampionsAndAbilities(
    ddragonVersion: string,
    patchVersion: string
  ): Promise<number> {
    const [listBody, championModule] = await Promise.all([
      this.fetchDdragon<DdragonChampionListBody>(
        `${DDRAGON_CDN}/${ddragonVersion}/data/en_US/champion.json`
      ),
      this.fetchWikiModule("Module:ChampionData/data"),
    ]);

    const abilityBlocks = parseChampionAbilityModule(championModule);
    // Wiki name → ability records, keyed by display name so we can join with
    // DDragon's per-alias rows below.
    const abilitiesByWikiName = new Map(
      abilityBlocks.map((b) => [b.championWikiName, b.abilities])
    );

    const now = new Date();
    let written = 0;
    for (const [alias, data] of Object.entries(listBody.data)) {
      const championId = Number(data.key);
      if (!Number.isFinite(championId)) continue;
      const name = data.name;
      const abilities = abilitiesByWikiName.get(name) ?? [];
      try {
        await this.upsertChampion(
          championId,
          alias,
          name,
          data.tags ?? [],
          abilities,
          patchVersion,
          now
        );
        written++;
      } catch (err) {
        this.logger.warn(
          `Champion upsert failed for ${alias} (${name})`,
          err instanceof Error ? err.message : err
        );
      }
    }
    return written;
  }

  private async upsertChampion(
    id: number,
    alias: string,
    name: string,
    roles: string[],
    abilities: ReadonlyArray<{ slot: string; name: string }>,
    patchVersion: string,
    now: Date
  ): Promise<void> {
    const wikiHadAbilities = abilities.length > 0;
    await this.prisma.$transaction([
      this.prisma.lolChampion.upsert({
        where: { id },
        create: {
          id,
          alias,
          name,
          roles,
          ddragonSyncedAt: now,
          wikiSyncedAt: wikiHadAbilities ? now : null,
          wikiSyncedPatchVersion: wikiHadAbilities ? patchVersion : null,
        },
        update: {
          alias,
          name,
          roles,
          ddragonSyncedAt: now,
          ...(wikiHadAbilities
            ? { wikiSyncedAt: now, wikiSyncedPatchVersion: patchVersion }
            : {}),
        },
      }),
      this.prisma.lolChampionAbility.deleteMany({ where: { championId: id } }),
      ...(wikiHadAbilities
        ? [
            this.prisma.lolChampionAbility.createMany({
              data: abilities.map((a, abilityIndex) => ({
                championId: id,
                slot: a.slot,
                abilityIndex,
                name: a.name,
              })),
            }),
          ]
        : []),
    ]);
  }

  async syncSummonerSpells(ddragonVersion: string): Promise<number> {
    const body = await this.fetchDdragon<DdragonSummonerSpellsBody>(
      `${DDRAGON_CDN}/${ddragonVersion}/data/en_US/summoner.json`
    );
    const now = new Date();
    const seenIds = new Set<number>();
    let written = 0;
    for (const spell of Object.values(body.data)) {
      const id = Number(spell.key);
      if (!Number.isFinite(id)) continue;
      seenIds.add(id);
      try {
        await this.prisma.lolSummonerSpell.upsert({
          where: { id },
          create: {
            id,
            name: spell.name,
            iconWikiName: spell.name,
            ddragonSyncedAt: now,
            missingSyncCycles: 0,
          },
          update: {
            name: spell.name,
            iconWikiName: spell.name,
            ddragonSyncedAt: now,
            missingSyncCycles: 0,
            retiredAt: null,
          },
        });
        written++;
      } catch (err) {
        this.logger.warn(
          `Summoner-spell upsert failed for ${spell.name} (${id})`,
          err instanceof Error ? err.message : err
        );
      }
    }
    await this.bumpMissingCycles("lolSummonerSpell", seenIds, now);
    return written;
  }

  async syncPerks(ddragonVersion: string): Promise<number> {
    const body = await this.fetchDdragon<DdragonRunesReforged>(
      `${DDRAGON_CDN}/${ddragonVersion}/data/en_US/runesReforged.json`
    );
    const now = new Date();
    const seenIds = new Set<number>();
    let written = 0;
    for (const path of body) {
      const slots = path.slots ?? [];
      for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
        const slot = slots[slotIdx];
        if (!slot) continue;
        const slotLabel = slotIdx === 0 ? "Keystone" : `Slot${slotIdx}`;
        for (const rune of slot.runes ?? []) {
          seenIds.add(rune.id);
          try {
            await this.prisma.lolPerk.upsert({
              where: { id: rune.id },
              create: {
                id: rune.id,
                name: rune.name,
                path: path.name,
                slot: slotLabel,
                iconWikiName: rune.name,
                ddragonSyncedAt: now,
                missingSyncCycles: 0,
              },
              update: {
                name: rune.name,
                path: path.name,
                slot: slotLabel,
                iconWikiName: rune.name,
                ddragonSyncedAt: now,
                missingSyncCycles: 0,
                retiredAt: null,
              },
            });
            written++;
          } catch (err) {
            this.logger.warn(
              `Perk upsert failed for ${rune.name} (${rune.id})`,
              err instanceof Error ? err.message : err
            );
          }
        }
      }
    }
    await this.bumpMissingCycles("lolPerk", seenIds, now);
    return written;
  }

  // Drift detection. Rows whose id wasn't returned by DDragon this cycle get
  // their `missingSyncCycles` incremented; once the counter passes the
  // threshold, `retiredAt` is set. The row is *kept* even after retirement
  // because historical match data still references the old perkId/spellId.
  // Counter resets to 0 on the next successful upsert above. The two model
  // delegates have identical shape but distinct TS types, so they get
  // handled in parallel branches rather than via a shared `delegate` var.
  private async bumpMissingCycles(
    model: "lolSummonerSpell" | "lolPerk",
    seenIds: ReadonlySet<number>,
    now: Date
  ): Promise<void> {
    const seen = [...seenIds];
    if (model === "lolSummonerSpell") {
      const stale = await this.prisma.lolSummonerSpell.findMany({
        where: { id: { notIn: seen }, retiredAt: null },
        select: { id: true, missingSyncCycles: true },
      });
      for (const row of stale) {
        const next = row.missingSyncCycles + 1;
        const retired = next >= MISSING_CYCLES_BEFORE_RETIRED;
        await this.prisma.lolSummonerSpell.update({
          where: { id: row.id },
          data: { missingSyncCycles: next, retiredAt: retired ? now : null },
        });
      }
    } else {
      const stale = await this.prisma.lolPerk.findMany({
        where: { id: { notIn: seen }, retiredAt: null },
        select: { id: true, missingSyncCycles: true },
      });
      for (const row of stale) {
        const next = row.missingSyncCycles + 1;
        const retired = next >= MISSING_CYCLES_BEFORE_RETIRED;
        await this.prisma.lolPerk.update({
          where: { id: row.id },
          data: { missingSyncCycles: next, retiredAt: retired ? now : null },
        });
      }
    }
  }

  // Read-side: returns the entire static catalog as a single bundle for the
  // web app to fetch once on boot. Retired rows are KEPT (web filters by
  // `retiredAt === null` for current-meta UI) so historical match data can
  // still resolve old perkId/spellId references. Bundle is ~50–80KB JSON
  // before gzip; TanStack Query caches it with `staleTime: Infinity`.
  async getBundle(): Promise<LolStaticBundle> {
    const [champions, abilities, items, spells, perks] = await Promise.all([
      this.prisma.lolChampion.findMany({ orderBy: { name: "asc" } }),
      this.prisma.lolChampionAbility.findMany({
        orderBy: [{ championId: "asc" }, { slot: "asc" }, { abilityIndex: "asc" }],
      }),
      this.prisma.lolItem.findMany({ orderBy: { id: "asc" } }),
      this.prisma.lolSummonerSpell.findMany({ orderBy: { id: "asc" } }),
      this.prisma.lolPerk.findMany({ orderBy: { id: "asc" } }),
    ]);

    const championAbilities: Record<number, LolChampionAbilityDto[]> = {};
    for (const a of abilities) {
      let list = championAbilities[a.championId];
      if (!list) {
        list = [];
        championAbilities[a.championId] = list;
      }
      list.push({
        slot: a.slot,
        abilityIndex: a.abilityIndex,
        name: a.name,
        iconWikiName: a.iconWikiName,
        descriptionWikitext: a.descriptionWikitext,
        descriptionHtml: a.descriptionHtml,
      });
    }

    // syncedAt: pick the freshest write across any source. ddragonSyncedAt
    // moves on every perk/spell/champion sync; wikiSyncedAt on items +
    // champion abilities. Max-of-all is the most honest "this snapshot was
    // last touched at" value.
    const timestamps: Date[] = [];
    for (const c of champions) {
      timestamps.push(c.ddragonSyncedAt);
      if (c.wikiSyncedAt) timestamps.push(c.wikiSyncedAt);
    }
    for (const i of items) timestamps.push(i.wikiSyncedAt);
    for (const s of spells) {
      timestamps.push(s.ddragonSyncedAt);
      if (s.wikiSyncedAt) timestamps.push(s.wikiSyncedAt);
    }
    for (const p of perks) {
      timestamps.push(p.ddragonSyncedAt);
      if (p.wikiSyncedAt) timestamps.push(p.wikiSyncedAt);
    }
    const syncedAt =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((d) => d.getTime()))).toISOString()
        : null;

    // Item rows always carry `wikiSyncedPatchVersion`; champions' is
    // nullable until the wiki content sync catches up. Take items first,
    // fall back to champions, then null on cold-start.
    const patchVersion =
      items[0]?.wikiSyncedPatchVersion ??
      champions.find((c) => c.wikiSyncedPatchVersion)?.wikiSyncedPatchVersion ??
      null;

    return {
      patchVersion,
      syncedAt,
      champions: champions.map<LolChampionDto>((c) => ({
        id: c.id,
        alias: c.alias,
        name: c.name,
        roles: Array.isArray(c.roles) ? (c.roles as string[]) : [],
      })),
      championAbilities,
      items: items.map<LolItemDto>((i) => ({
        id: i.id,
        name: i.name,
        tier: i.tier,
        itemType: Array.isArray(i.itemType) ? (i.itemType as string[]) : [],
        priceTotal: i.priceTotal,
        recipe: Array.isArray(i.recipe) ? (i.recipe as string[]) : [],
        categories: Array.isArray(i.categories) ? (i.categories as string[]) : [],
        stats:
          i.stats && typeof i.stats === "object" && !Array.isArray(i.stats)
            ? (i.stats as Record<string, number>)
            : {},
        descriptionWikitext: i.descriptionWikitext,
        descriptionHtml: i.descriptionHtml,
        iconWikiName: i.iconWikiName,
      })),
      summonerSpells: spells.map<LolSummonerSpellDto>((s) => ({
        id: s.id,
        name: s.name,
        iconWikiName: s.iconWikiName,
        descriptionWikitext: s.descriptionWikitext,
        descriptionHtml: s.descriptionHtml,
        retiredAt: s.retiredAt ? s.retiredAt.toISOString() : null,
      })),
      perks: perks.map<LolPerkDto>((p) => ({
        id: p.id,
        name: p.name,
        path: p.path,
        slot: p.slot,
        iconWikiName: p.iconWikiName,
        descriptionWikitext: p.descriptionWikitext,
        descriptionHtml: p.descriptionHtml,
        retiredAt: p.retiredAt ? p.retiredAt.toISOString() : null,
      })),
    };
  }

  private async fetchLatestDdragonVersion(): Promise<string> {
    const versions = await this.fetchDdragon<string[]>(DDRAGON_VERSIONS);
    const first = versions[0];
    if (!first) throw new Error("ddragon versions response was empty");
    return first;
  }

  private async fetchDdragon<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`ddragon ${url} HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  // Fetches `Template:Data {Champion}/{Ability}` for every persisted ability
  // row, parses the `description` + `icon` fields, renders the description
  // wikitext to HTML via MediaWiki's action=parse, and updates the ability
  // row. Runs every cron tick — items follow the same always-refresh
  // convention so balance-patch description rewrites land within one cycle.
  // Per-ability try/catch isolates parse + network failures.
  async syncChampionAbilityDescriptions(patchVersion: string): Promise<number> {
    const abilities = await this.prisma.lolChampionAbility.findMany({
      include: { champion: { select: { name: true } } },
    });

    let written = 0;
    for (const a of abilities) {
      try {
        const wikitext = await this.fetchWikiPage(
          `Template:Data ${a.champion.name}/${a.name}`
        );
        if (!wikitext) continue;
        const parsed = parseAbilityTemplate(wikitext);
        if (!parsed.description && !parsed.icon) continue;

        let descriptionHtml: string | null = null;
        if (parsed.description) {
          try {
            descriptionHtml = await this.renderWikitextToHtml(parsed.description);
          } catch (err) {
            this.logger.warn(
              `action=parse failed for ${a.champion.name}/${a.name}: ${
                err instanceof Error ? err.message : err
              }`
            );
          }
        }

        await this.prisma.lolChampionAbility.update({
          where: {
            championId_slot_abilityIndex: {
              championId: a.championId,
              slot: a.slot,
              abilityIndex: a.abilityIndex,
            },
          },
          data: {
            descriptionWikitext: parsed.description,
            descriptionHtml,
            iconWikiName: parsed.icon,
          },
        });
        written++;
      } catch (err) {
        this.logger.warn(
          `Ability description sync failed for ${a.champion.name}/${a.name}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }
    // patchVersion is logged via syncAll; ability rows don't carry the
    // per-row sync-state columns that items + bridge resources do — the
    // parent LolChampion row owns wikiSyncedAt/wikiSyncedPatchVersion.
    void patchVersion;
    return written;
  }

  private async fetchWikiPage(title: string): Promise<string | null> {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", title);
    url.searchParams.set("prop", "revisions");
    url.searchParams.set("rvprop", "content");
    url.searchParams.set("rvslots", "main");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`wiki ${title} HTTP ${res.status}`);
    const body = (await res.json()) as WikiModuleResponse;
    const page = Object.values(body.query?.pages ?? {})[0];
    return page?.revisions?.[0]?.slots?.main?.["*"] ?? null;
  }

  private async renderWikitextToHtml(wikitext: string): Promise<string> {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "parse");
    url.searchParams.set("text", wikitext);
    url.searchParams.set("contentmodel", "wikitext");
    url.searchParams.set("prop", "text");
    url.searchParams.set("disablelimitreport", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`wiki parse HTTP ${res.status}`);
    const body = (await res.json()) as { parse?: { text?: string } };
    const html = body.parse?.text;
    if (!html) throw new Error("wiki parse returned no text");
    return html;
  }

  private async fetchWikiModule(title: string): Promise<string> {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", title);
    url.searchParams.set("prop", "revisions");
    url.searchParams.set("rvprop", "content");
    url.searchParams.set("rvslots", "main");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`wiki ${title} HTTP ${res.status}`);
    const body = (await res.json()) as WikiModuleResponse;
    const page = Object.values(body.query?.pages ?? {})[0];
    const content = page?.revisions?.[0]?.slots?.main?.["*"];
    if (!content) throw new Error(`wiki ${title} had no content`);
    return content;
  }
}
