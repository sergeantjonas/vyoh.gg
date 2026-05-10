import { LiveGameChip } from "@/lol/_shared/live-game-chip";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { ProfileActivityCalendar } from "@/lol/profile/profile-activity-calendar";
import { ProfileLpHistory } from "@/lol/profile/profile-lp-history";
import { ProfileNowPlaying } from "@/lol/profile/profile-now-playing";
import { ProfileQueueDistribution } from "@/lol/profile/profile-queue-distribution";
import { ProfileRankTiles } from "@/lol/profile/profile-rank-tile";
import { ProfileRecentForm } from "@/lol/profile/profile-recent-form";
import { ProfileRoleStrip } from "@/lol/profile/profile-role-strip";
import { ProfileSeasonHistory } from "@/lol/profile/profile-season-history";
import { ProfileStatsBar } from "@/lol/profile/profile-stats-bar";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import { createFileRoute } from "@tanstack/react-router";

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
      <ProfileRecentForm accountSlug={accountSlug} />
      <ProfileLpHistory accountSlug={accountSlug} />
      <ProfileSeasonHistory accountSlug={accountSlug} />
      <ProfileNowPlaying />
      <ProfileRoleStrip />
      <ProfileQueueDistribution />
      {matches && matches.length > 0 && <ProfileActivityCalendar matches={matches} />}
      <ProfileStatsBar />
    </div>
  );
}
