import { LiveGameChip } from "@/lol/_shared/live-game-chip";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { ProfileActivityCalendar } from "@/lol/profile/profile-activity-calendar";
import { ProfileDuos } from "@/lol/profile/profile-duos";
import { ProfileLpHistory } from "@/lol/profile/profile-lp-history";
import { ProfileNowPlaying } from "@/lol/profile/profile-now-playing";
import { ProfilePregameRitual } from "@/lol/profile/profile-pregame-ritual";
import { ProfileQueueDistribution } from "@/lol/profile/profile-queue-distribution";
import { ProfileRankTiles } from "@/lol/profile/profile-rank-tile";
import { ProfileRecentForm } from "@/lol/profile/profile-recent-form";
import { ProfileRoleStrip } from "@/lol/profile/profile-role-strip";
import { ProfileSeasonHistory } from "@/lol/profile/profile-season-history";
import { ProfileStatsBar } from "@/lol/profile/profile-stats-bar";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/lol/$accountSlug/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const rank = useProfileRank(account);
  const { matches } = useMatchWindow();

  return (
    <div className="flex flex-col gap-6">
      <ProfileRankTiles entries={rank.data?.rankEntries ?? []} />
      <LiveGameChip accountSlug={accountSlug} />
      <ProfilePregameRitual />
      <ProfileRecentForm accountSlug={accountSlug} />
      <ProfileLpHistory accountSlug={accountSlug} />
      <ProfileSeasonHistory accountSlug={accountSlug} />
      <ProfileNowPlaying />
      <ProfileRoleStrip />
      <ProfileDuos accountSlug={accountSlug} />
      <ProfileQueueDistribution />
      {matches && matches.length > 0 && <ProfileActivityCalendar matches={matches} />}
      <ProfileStatsBar />
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
