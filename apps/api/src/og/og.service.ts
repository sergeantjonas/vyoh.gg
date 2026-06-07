import { Injectable, NotFoundException } from "@nestjs/common";
import {
  type SteamGameRecap,
  excludeRemakes,
  formatDuration,
  formatKda,
  formatPercent,
  formatPlaytimeFromSeconds,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { LolImageService } from "../img/lol-image.service";
import { SteamImageService } from "../img/steam-image.service";
import { LolService } from "../lol/lol.service";
import { PrismaService } from "../prisma/prisma.service";
import { SteamGameRecapService } from "../steam/game-recap.service";
import {
  renderChampionCard,
  renderHomeCard,
  renderMatchCard,
  renderProfileCard,
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

@Injectable()
export class OgService {
  constructor(
    private readonly lol: LolService,
    private readonly identity: IdentityService,
    private readonly lolImage: LolImageService,
    private readonly steamImage: SteamImageService,
    private readonly prisma: PrismaService,
    private readonly steamGameRecap: SteamGameRecapService
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
      queueType: detail.queueType,
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

    // Rank line — prefer solo over flex (matches the in-app hierarchy). Apex
    // tiers (Master+) drop the division to match what the frontend renders.
    const solo = profile.rankEntries.find((r) => r.queueId === "RANKED_SOLO_5x5");
    const flex = profile.rankEntries.find((r) => r.queueId === "RANKED_FLEX_SR");
    const primary = solo ?? flex ?? null;
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
      recap = await this.steamGameRecap.getGameRecap(appid);
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
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
