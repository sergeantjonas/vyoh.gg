import { Injectable, NotFoundException } from "@nestjs/common";
import {
  OWNER_TIME_ZONE,
  RANKED_QUEUE_KEYS,
  RANKED_QUEUE_KEY_TO_TYPE,
  type SteamGameRecap,
  championTheme,
  excludeRemakes,
  formatDuration,
  formatKda,
  formatPercent,
  formatPlaytimeFromSeconds,
  getPrimaryAccount,
  queueLabel,
  renderSeasonRidge,
  selectChampionOfYear,
} from "@vyoh/shared";
import { HomeLifetimeTotalsService } from "../home/home-lifetime-totals.service";
import { IdentityService } from "../identity/identity.service";
import { LolImageService } from "../img/lol-image.service";
import { SteamImageService } from "../img/steam-image.service";
import { LolChampionAnalyticsService } from "../lol/lol-champion-analytics.service";
import { LolService } from "../lol/lol.service";
import { PrismaService } from "../prisma/prisma.service";
import { SteamGameCurationService } from "../steam/game-curation.service";
import { SteamGameRecapService } from "../steam/game-recap.service";
import {
  renderChampionCard,
  renderHomeCard,
  renderMatchCard,
  renderProfileCard,
  renderRecapChapterCard,
  renderSteamGameCard,
} from "./og-card";

// Display tagline reused across both the home OG and any future home-meta
// surfaces. Owner-curated; lives here so the home OG endpoint stays a thin
// composition rather than threading the string from app config.
const HOME_TAGLINE = "A personal cross-stream gaming dashboard";

// Apex tiers (no division). Mirrors the same constant in the LoL hero strip;
// kept here as a local copy so the OG service doesn't reach into web-only
// frontend code for what is a tiny domain rule.
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

// The two shareable recap chapters on `/`. Copy mirrors the chapters
// themselves (`ahri-chapter.tsx`, `conclusion-chapter.tsx`) — those files are
// the source of truth for masthead strings and the conclusion accent.
export type RecapChapterKey = "champion" | "conclusion";
const RECAP_CHAMPION_ALIAS = "Ahri";
const RECAP_CHAMPION_TITLE = "the Nine-Tailed Fox";
const CONCLUSION_ACCENT = "#f0c878";

// Full cached history for the ridge background — the same window the recap
// hero band reads (see `RecapSeasonThread`), so card and page render the same
// artwork.
const RIDGE_WINDOW_COUNT = 2000;

const RIDGE_RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

@Injectable()
export class OgService {
  constructor(
    private readonly lol: LolService,
    private readonly identity: IdentityService,
    private readonly lolImage: LolImageService,
    private readonly steamImage: SteamImageService,
    private readonly prisma: PrismaService,
    private readonly steamGameRecap: SteamGameRecapService,
    private readonly championAnalytics: LolChampionAnalyticsService,
    private readonly lifetimeTotals: HomeLifetimeTotalsService,
    private readonly curation: SteamGameCurationService
  ) {}

  async generateMatchCard(slug: string, matchId: string): Promise<Buffer> {
    const account = this.identity.findBySlug(slug);
    if (!account) {
      throw new NotFoundException(`No account for slug "${slug}"`);
    }

    const detail = await this.lol.getMatchDetail(matchId);
    const me = detail.participants.find(
      (p) =>
        p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
        p.riotIdTagline.toLowerCase() === account.tagLine.toLowerCase()
    );
    if (!me) {
      throw new NotFoundException(
        `Participant ${account.gameName}#${account.tagLine} not found in match ${matchId}`
      );
    }

    // Resolver-sourced splash URL chain: wiki primary + CDragon fallback.
    // Bypasses the proxy HTTP boundary (we'd just pay a WebP round-trip) but
    // uses the same canonical asset resolver every other LoL surface uses.
    const { urls: splashUrls } = await this.lolImage.champion(me.championName, "card");

    return renderMatchCard({
      championName: me.championName,
      splashUrls,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      win: me.win,
      queueLabel: queueLabel(detail.queueId),
      durationLabel: formatDuration(detail.durationSec),
      accountLabel: `${account.gameName}#${account.tagLine}`,
      region: account.region.toUpperCase(),
    });
  }

  async generateChampionCard(alias: string): Promise<Buffer> {
    // Champion identity from the synced DB row; modernClasses populated by
    // the wiki sync. Case-insensitive equals so a URL like
    // `/og/champion/jinx.png` resolves the same row as the canonical `Jinx`
    // — the route param preserves whatever the sharer typed. Cold-start with
    // no row falls through to 404.
    const champion = await this.prisma.lolChampion.findFirst({
      where: { alias: { equals: alias, mode: "insensitive" } },
      select: { alias: true, name: true, modernClasses: true, roles: true },
    });
    if (!champion) {
      throw new NotFoundException(`No champion for alias "${alias}"`);
    }

    // Sub-label composition: classes first (modern wiki taxonomy), fall back
    // to the legacy DDragon roles tags if wiki sync hasn't covered this
    // champion yet (a brand-new release between cron ticks). One terse
    // editorial line — capped at the first two entries so a champion with
    // three classes doesn't blow the OG layout.
    const classes = (champion.modernClasses as string[] | null) ?? [];
    const roles = (champion.roles as string[] | null) ?? [];
    const tagLabels = classes.length > 0 ? classes : roles;
    const subLabel = tagLabels.slice(0, 2).join(" · ");

    const { urls: splashUrls } = await this.lolImage.champion(champion.alias, "hd");

    return renderChampionCard({
      championName: champion.name,
      splashUrls,
      subLabel,
    });
  }

  async generateProfileCard(slug: string): Promise<Buffer> {
    const account = this.identity.findBySlug(slug);
    if (!account) {
      throw new NotFoundException(`No account for slug "${slug}"`);
    }

    // Two reads in parallel — independent DB hits, no point serialising.
    const [profile, matchesWindow] = await Promise.all([
      this.lol.getSummonerProfile(account.region, account.gameName, account.tagLine),
      this.lol.getCachedMatches(
        account.region,
        account.gameName,
        account.tagLine,
        0,
        // Wide window so the KPI strip reflects the account's at-a-glance
        // story, not just the last few games. Same `Match` table the
        // analytics service reads — cheap.
        500
      ),
    ]);

    // Rank line — walks RANKED_QUEUE_KEYS, whose order is the in-app display
    // hierarchy, and takes the first ladder the account has standing on. Apex
    // tiers (Master+) drop the division to match what the frontend renders.
    const primary =
      RANKED_QUEUE_KEYS.map((key) =>
        profile.rankEntries.find((r) => r.queueId === RANKED_QUEUE_KEY_TO_TYPE[key])
      ).find((entry) => entry !== undefined) ?? null;
    const rankLine = primary
      ? `${capitalize(primary.tier)}${APEX_TIERS.has(primary.tier) ? "" : ` ${primary.rank}`} · ${primary.leaguePoints} LP`
      : null;

    // KPI computation — same shape as the in-app profile strip but boiled
    // down to three editorial tiles. Excludes remakes per the domain
    // invariant in `excludeRemakes` (see repo conventions).
    const real = excludeRemakes(matchesWindow.matches);
    const totalGames = real.length;
    const wins = real.filter((m) => m.win).length;
    const wr = totalGames > 0 ? formatPercent(wins / totalGames) : "—";
    const totalK = real.reduce((sum, m) => sum + m.kills, 0);
    const totalD = real.reduce((sum, m) => sum + m.deaths, 0);
    const totalA = real.reduce((sum, m) => sum + m.assists, 0);
    const kda = totalGames > 0 ? formatKda((totalK + totalA) / Math.max(1, totalD)) : "—";

    // Signature-champion splash — same selector the profile page itself uses
    // for the cinematic hero backdrop. Keeps the OG and the destination page
    // visually aligned: a viewer who clicks through sees the same champion
    // they saw in the share preview. Empty match window → empty URL list →
    // the card falls back to its typographic-only layout.
    const signature = selectChampionOfYear(matchesWindow.matches);
    const splashUrls = signature
      ? (await this.lolImage.champion(signature.champion, "hd")).urls
      : [];

    return renderProfileCard({
      // gameName#tagLine per [og-image-pipeline.md decision #5].
      accountLabel: `${account.gameName}#${account.tagLine}`,
      rankLine,
      kpis: [
        { label: "Win rate", value: wr },
        { label: "KDA", value: kda },
        { label: "Games", value: totalGames.toString() },
      ],
      region: account.region.toUpperCase(),
      splashUrls,
    });
  }

  generateHomeCard(): Promise<Buffer> {
    // No upstream calls — the home card is fully self-contained. Still
    // rendered per request (per decision #2) so the endpoint shape stays
    // uniform across every OG surface; the HTTP cache layer absorbs the
    // repeat-render cost.
    return renderHomeCard({ tagline: HOME_TAGLINE });
  }

  async generateSteamGameCard(appid: number): Promise<Buffer> {
    let recap: SteamGameRecap;
    try {
      // The public curation, never the owner's — an OG card is rendered for
      // whatever scrapes the URL, cached, and then reposted by whoever shares
      // the link. There is no viewer to be aware of, and a card naming a hidden
      // game would be the one copy of that name that outlives the hiding.
      recap = await this.steamGameRecap.getGameRecap(
        appid,
        await this.curation.getCuration()
      );
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Steam app ${appid} unavailable`);
    }

    // Steam hero resolution — large-hero variant matches what the in-app
    // game-detail page uses. The resolver reads the per-app asset row
    // (timestamp + content-hash + SGDB fallback) internally; the in-app
    // route segments are cache-key plumbing, not part of the resolution
    // contract, so the OG path skips them.
    const { urls: heroUrls } = await this.steamImage.heroLarge(appid);

    // KPI composition — three editorial tiles. Same formatters the in-app
    // surfaces use (`formatPlaytimeFromSeconds`, `formatPercent`), so the OG
    // strings match what a viewer sees if they click through.
    const completionLabel =
      recap.completionPct !== null ? formatPercent(recap.completionPct) : "—";
    const playtimeLabel = formatPlaytimeFromSeconds(recap.playtimeForeverMinutes * 60);

    return renderSteamGameCard({
      gameName: recap.name,
      heroUrls,
      shortDescription: recap.shortDescription,
      kpis: [
        { label: "Playtime", value: playtimeLabel },
        { label: "Completion", value: completionLabel },
        {
          label: "Recent",
          value:
            recap.playtime2WeeksMinutes !== null
              ? formatPlaytimeFromSeconds(recap.playtime2WeeksMinutes * 60)
              : "—",
        },
      ],
    });
  }

  async generateRecapChapterCard(chapter: RecapChapterKey): Promise<Buffer> {
    // Owner-scoped, no slug: `/` has a single subject. Same resolution the
    // recap chapters themselves use (`getPrimaryAccount` drives the Ahri
    // chapter's account framing).
    const account = getPrimaryAccount(this.identity.getLolAccounts());
    if (!account) {
      throw new NotFoundException("No primary owner account configured");
    }

    const window = await this.lol.getCachedMatches(
      account.region,
      account.gameName,
      account.tagLine,
      0,
      RIDGE_WINDOW_COUNT
    );

    // Identity surface, so all queues; remakes are the only exclusion. Sorted
    // oldest-first — the walk reads left to right. Same projection as the
    // recap hero band, so the card background is the page's artwork.
    const played = excludeRemakes(window.matches).sort(
      (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt)
    );
    const ridgeSvg = renderSeasonRidge(
      played.map((m) => ({
        win: m.win,
        kills: m.kills,
        colorHex: championTheme(m.champion).dominantHex,
      })),
      { background: "#0a0a0a" }
    );
    const first = played[0];
    const last = played[played.length - 1];
    const threadLabel =
      first && last
        ? `${played.length} games · ${RIDGE_RANGE_FMT.format(new Date(first.playedAt))} – ${RIDGE_RANGE_FMT.format(new Date(last.playedAt))}`
        : "";

    if (chapter === "champion") {
      const recap = await this.championAnalytics.getChampionRecap(
        account.region,
        account.gameName,
        account.tagLine,
        RECAP_CHAMPION_ALIAS
      );
      return renderRecapChapterCard({
        eyebrow: `${account.gameName}'s ${RECAP_CHAMPION_ALIAS}`,
        title: RECAP_CHAMPION_ALIAS,
        subtitle: RECAP_CHAMPION_TITLE,
        accentHex: championTheme(RECAP_CHAMPION_ALIAS).dominantHex,
        ridgeSvg,
        kpis: [
          { label: "Games", value: recap.totalGames.toString() },
          {
            label: "Win rate",
            value: recap.winRate !== null ? formatPercent(recap.winRate) : "—",
          },
          {
            label: "Avg KDA",
            value: recap.avgKda !== null ? formatKda(recap.avgKda) : "—",
          },
        ],
        threadLabel,
      });
    }

    const totals = await this.lifetimeTotals.getLifetimeTotals();
    return renderRecapChapterCard({
      eyebrow: `${account.gameName}'s portrait`,
      title: account.gameName,
      subtitle: "the player",
      accentHex: CONCLUSION_ACCENT,
      ridgeSvg,
      kpis: [
        { label: "LoL matches", value: totals.lolMatchCount.toString() },
        {
          label: "LoL time",
          value: formatPlaytimeFromSeconds(totals.lolMinutes * 60),
        },
        {
          label: "Steam time",
          value: formatPlaytimeFromSeconds(totals.steamMinutes * 60),
        },
      ],
      threadLabel,
    });
  }
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
