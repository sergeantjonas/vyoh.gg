import { CvSection, SectionPlaceholder } from "@/_shared/cv-section";
import { routeMeta } from "@/lib/route-meta";
import { LiveGameChip } from "@/lol/_shared/account/live-game-chip";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { DamageProfileRadar } from "@/lol/_shared/damage-profile-radar";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { useLiveGame } from "@/lol/matches/use-live-match";
import { ProfilePatchNotice } from "@/lol/patches/profile-patch-notice";
import { LolIdentityHero } from "@/lol/profile/identity-hero";
import { ProfileCarryProfile } from "@/lol/profile/profile-carry-profile";
import { ProfileDuos } from "@/lol/profile/profile-duos";
import { ProfileMultikillStrip } from "@/lol/profile/profile-multikill-strip";
import { ProfileNowPlaying } from "@/lol/profile/profile-now-playing";
import { ProfileObjectiveFirsts } from "@/lol/profile/profile-objective-firsts";
import { ProfileObjectiveParticipation } from "@/lol/profile/profile-objective-participation";
import { ProfileQueueDistribution } from "@/lol/profile/profile-queue-distribution";
import { ProfileRecentForm } from "@/lol/profile/profile-recent-form";
import { ProfileRoleStrip } from "@/lol/profile/profile-role-strip";
import { ProfileSquads } from "@/lol/profile/profile-squads";
import { ProfileStatsBar } from "@/lol/profile/profile-stats-bar";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import { selectChampionOfYear } from "@/lol/recap/recap-champion";
import { Link, createFileRoute } from "@tanstack/react-router";
import { excludeRemakes } from "@vyoh/shared";
import { normalizeLp } from "@vyoh/shared/lol/rank-history";
import { ChevronRight } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo } from "react";

// Heavy below-fold sections — Recharts, large render trees, or both. Splitting
// them out of the eager profile-route chunk lets the above-fold hero + light
// sections paint in the first commit while the heavy ones hydrate behind their
// own bounded-height placeholders. Re-checked when the section list grows or
// the probe shows a new section as a paint blocker.
const ProfilePregameRitual = lazy(() =>
  import("@/lol/profile/profile-pregame-ritual").then((m) => ({
    default: m.ProfilePregameRitual,
  }))
);
const ProfilePostGame = lazy(() =>
  import("@/lol/profile/profile-post-game").then((m) => ({
    default: m.ProfilePostGame,
  }))
);
const ProfileLpHistory = lazy(() =>
  import("@/lol/profile/profile-lp-history").then((m) => ({
    default: m.ProfileLpHistory,
  }))
);
const ProfileSeasonHistory = lazy(() =>
  import("@/lol/profile/profile-season-history").then((m) => ({
    default: m.ProfileSeasonHistory,
  }))
);
const ProfileSynergy = lazy(() =>
  import("@/lol/profile/profile-synergy").then((m) => ({
    default: m.ProfileSynergy,
  }))
);
const ProfileActivityCalendar = lazy(() =>
  import("@/lol/profile/profile-activity-calendar").then((m) => ({
    default: m.ProfileActivityCalendar,
  }))
);

// API origin for the per-route OG image endpoint. Local rather than imported
// so head() stays a leaf with no transitive deps on the initial-route graph.
const API_URL = "http://localhost:2010";

export const Route = createFileRoute("/lol/$accountSlug/")({
  component: ProfilePage,
  // Static fallback used until `ProfilePage` enriches `document.title`
  // with the resolved `gameName#tagLine` (see the useEffect below).
  // Crawlers that never run the component still get a non-slug title.
  // Mirrors the same pattern in the Steam game-detail route. The slug is
  // an opaque URL identifier; LoL identity is always `gameName#tagLine`.
  head: ({ params }) =>
    routeMeta({
      title: "Profile · vyoh.gg",
      description: "LoL profile on vyoh.gg",
      ogImage: `${API_URL}/og/profile/${params.accountSlug}.png`,
      ogType: "profile",
    }),
});

function ProfilePage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);

  // Tab title enrichment. The route's `head()` ships a static "Profile ·
  // vyoh.gg" fallback so crawlers and pre-resolve loads aren't stuck on the
  // opaque URL slug; once `useAccountFromSlug` resolves the LoL identity we
  // swap to `gameName#tagLine` — the canonical LoL identity form, same as
  // the OG card body. No restore-on-unmount — TanStack Router fires the
  // next route's head() on navigation, which overwrites the title. Mirrors
  // the same pattern used in the Steam game-detail route.
  useEffect(() => {
    if (account) {
      document.title = `${account.gameName}#${account.tagLine} · vyoh.gg`;
    }
  }, [account]);

  const rank = useProfileRank(account);
  // Shared with LiveGameChip below — TanStack Query dedupes the in-flight
  // fetch, so this second read is free on the wire. Drives the hero avatar's
  // activity ring; the chip below renders the richer live-game card.
  const liveGame = useLiveGame(account);
  const inLiveGame = liveGame.data != null;
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
  // Signature champion for the hero splash — the SAME selector the section
  // root uses to drive the ambient backdrop ([$accountSlug.tsx]), so the hero
  // brings that backdrop into focus instead of painting a second splash.
  const signatureChampion = useMemo(
    () => (matches ? (selectChampionOfYear(matches)?.champion ?? null) : null),
    [matches]
  );

  return (
    <div className="flex flex-col gap-6">
      <LolIdentityHero
        gameName={account?.gameName}
        tagLine={account?.tagLine}
        profileIconId={rank.data?.profileIconId}
        summonerLevel={rank.data?.summonerLevel}
        rankEntries={rank.data?.rankEntries ?? []}
        recentLpByQueue={recentLpByQueue}
        splashChampion={signatureChampion}
        lastMatch={lastMatch}
        inLiveGame={inLiveGame}
        accountSlug={accountSlug}
      />
      <LiveGameChip accountSlug={accountSlug} />
      <ProfilePatchNotice accountSlug={accountSlug} />
      <CvSection minHeight={280}>
        <Suspense fallback={<SectionPlaceholder minHeight={280} />}>
          <ProfilePregameRitual accountSlug={accountSlug} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={240}>
        <Suspense fallback={<SectionPlaceholder minHeight={240} />}>
          <ProfilePostGame accountSlug={accountSlug} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={120}>
        <ProfileRecentForm accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={420}>
        <Suspense fallback={<SectionPlaceholder minHeight={420} />}>
          <ProfileLpHistory accountSlug={accountSlug} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={200}>
        <Suspense fallback={<SectionPlaceholder minHeight={200} />}>
          <ProfileSeasonHistory accountSlug={accountSlug} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={160}>
        <ProfileNowPlaying accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={140}>
        <ProfileRoleStrip />
      </CvSection>
      <CvSection minHeight={160}>
        <ProfileDuos accountSlug={accountSlug} />
      </CvSection>
      {/* Not CV-gated: squads render null in the common no-3-stack case, so a
          reserved minHeight would leave a permanent empty gap. The section is
          light (≤3 rows) and brings its own footprint only when it appears. */}
      <ProfileSquads accountSlug={accountSlug} />
      <CvSection minHeight={200}>
        <Suspense fallback={<SectionPlaceholder minHeight={200} />}>
          <ProfileSynergy accountSlug={accountSlug} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={120}>
        <ProfileQueueDistribution />
      </CvSection>
      <CvSection minHeight={160}>
        <Suspense fallback={<SectionPlaceholder minHeight={160} />}>
          <ProfileActivityCalendar accountSlug={accountSlug} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={100}>
        <ProfileStatsBar accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={100}>
        <ProfileMultikillStrip accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={100}>
        <ProfileObjectiveFirsts accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={100}>
        <ProfileObjectiveParticipation accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={140}>
        <ProfileCarryProfile accountSlug={accountSlug} />
      </CvSection>
      <CvSection minHeight={340}>
        <DamageProfileRadar accountSlug={accountSlug} />
      </CvSection>
      {matches && matches.length > 0 && (
        <Link
          to="/lol/$accountSlug/recap"
          params={{ accountSlug }}
          className="group flex items-center justify-between rounded-lg border bg-card/60 px-4 py-3 text-sm backdrop-blur-sm transition-colors hover:bg-card/80"
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
