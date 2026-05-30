import { LiveGameChip } from "@/lol/_shared/account/live-game-chip";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { ProfilePatchNotice } from "@/lol/patches/profile-patch-notice";
import { LolIdentityBlock } from "@/lol/profile/identity-block";
import { ProfileActivityCalendar } from "@/lol/profile/profile-activity-calendar";
import { ProfileDuos } from "@/lol/profile/profile-duos";
import { ProfileLpHistory } from "@/lol/profile/profile-lp-history";
import { ProfileMultikillStrip } from "@/lol/profile/profile-multikill-strip";
import { ProfileNowPlaying } from "@/lol/profile/profile-now-playing";
import { ProfilePostGame } from "@/lol/profile/profile-post-game";
import { ProfilePregameRitual } from "@/lol/profile/profile-pregame-ritual";
import { ProfileQueueDistribution } from "@/lol/profile/profile-queue-distribution";
import { ProfileRecentForm } from "@/lol/profile/profile-recent-form";
import { ProfileRoleStrip } from "@/lol/profile/profile-role-strip";
import { ProfileSeasonHistory } from "@/lol/profile/profile-season-history";
import { ProfileStatsBar } from "@/lol/profile/profile-stats-bar";
import { ProfileSynergy } from "@/lol/profile/profile-synergy";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import { Link, createFileRoute } from "@tanstack/react-router";
import { excludeRemakes } from "@vyoh/shared";
import { normalizeLp } from "@vyoh/shared/lol/rank-history";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/lol/$accountSlug/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const rank = useProfileRank(account);
  // Shares the cache key with ProfileLpHistory below, so the second consumer
  // is free on the wire — TanStack Query dedupes the in-flight fetch and both
  // tiles + chart hydrate from the same response.
  const rankHistory = useRankHistory(account, "30d");
  const recentLpByQueue = useMemo<Record<string, number[]>>(() => {
    const data = rankHistory.data;
    if (!data) return {};
    const toSeries = (points: typeof data.solo) =>
      [...points]
        .sort(
          (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        )
        .map((p) => normalizeLp(p.tier, p.rank, p.leaguePoints));
    return {
      RANKED_SOLO_5x5: toSeries(data.solo),
      RANKED_FLEX_SR: toSeries(data.flex),
    };
  }, [rankHistory.data]);
  const { matches } = useMatchWindow();
  // Most-recent non-remake match drives the identity block's "last played X"
  // sub-row. Remakes are excluded so it mirrors the summary's
  // lastPlayedChampionAlias semantics (see the remake invariant convention).
  const lastMatch = useMemo(() => {
    if (!matches) return null;
    const real = excludeRemakes(matches);
    if (real.length === 0) return null;
    return real.reduce((latest, m) =>
      new Date(m.playedAt) > new Date(latest.playedAt) ? m : latest
    );
  }, [matches]);

  return (
    <div className="flex flex-col gap-6">
      <LolIdentityBlock
        gameName={account?.gameName}
        tagLine={account?.tagLine}
        profileIconId={rank.data?.profileIconId}
        summonerLevel={rank.data?.summonerLevel}
        rankEntries={rank.data?.rankEntries ?? []}
        recentLpByQueue={recentLpByQueue}
        lastMatch={lastMatch}
      />
      <LiveGameChip accountSlug={accountSlug} />
      <ProfilePatchNotice accountSlug={accountSlug} />
      <ProfilePregameRitual accountSlug={accountSlug} />
      <ProfilePostGame accountSlug={accountSlug} />
      <ProfileRecentForm accountSlug={accountSlug} />
      <ProfileLpHistory accountSlug={accountSlug} />
      <ProfileSeasonHistory accountSlug={accountSlug} />
      <ProfileNowPlaying accountSlug={accountSlug} />
      <ProfileRoleStrip />
      <ProfileDuos accountSlug={accountSlug} />
      <ProfileSynergy accountSlug={accountSlug} />
      <ProfileQueueDistribution />
      <ProfileActivityCalendar accountSlug={accountSlug} />
      <ProfileStatsBar />
      <ProfileMultikillStrip accountSlug={accountSlug} />
      {matches && matches.length > 0 && (
        <Link
          to="/lol/$accountSlug/recap"
          params={{ accountSlug }}
          className="group flex items-center justify-between rounded-lg border bg-card/30 px-4 py-3 text-sm transition-colors hover:bg-card/60"
        >
          <span className="flex flex-col">
            <span className="font-medium text-foreground/90">Your year so far</span>
            <span className="text-xs text-muted-foreground/70">
              A calm recap of your peak rank, headline champion, and standout pattern.
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
