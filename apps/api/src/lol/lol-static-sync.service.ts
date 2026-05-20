import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import {
  type ParsedItem,
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
    summonerSpells: number;
    perks: number;
  }> {
    const ddragonVersion = await this.fetchLatestDdragonVersion();
    const patchVersion = truncateVersion(ddragonVersion);

    // Run in series — wiki rate-limits sustained traffic at ~200/min and
    // the calls overlap on the same host. The 5 fetches here are well under
    // that, but per-template description fetches in a follow-up chunk will
    // push close to the limit.
    const items = await this.syncItems(patchVersion);
    const champions = await this.syncChampionsAndAbilities(ddragonVersion, patchVersion);
    const summonerSpells = await this.syncSummonerSpells(ddragonVersion);
    const perks = await this.syncPerks(ddragonVersion);

    this.logger.log(
      `Static sync ${patchVersion}: items=${items}, champions=${champions}, ` +
        `summonerSpells=${summonerSpells}, perks=${perks}`
    );

    return { patchVersion, items, champions, summonerSpells, perks };
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
