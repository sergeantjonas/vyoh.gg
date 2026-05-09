import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { ProfileGameLength } from "@/lol/profile/profile-game-length";
import { ProfileNowPlaying } from "@/lol/profile/profile-now-playing";
import { ProfilePoolEntropy } from "@/lol/profile/profile-pool-entropy";
import { ProfileRankTiles } from "@/lol/profile/profile-rank-tile";
import { ProfileRecentForm } from "@/lol/profile/profile-recent-form";
import { ProfileStatsBar } from "@/lol/profile/profile-stats-bar";
import { ProfileTiltIndicator } from "@/lol/profile/profile-tilt-indicator";
import { ProfileTimeHeatmap } from "@/lol/profile/profile-time-heatmap";
import { ProfileWeeklyReview } from "@/lol/profile/profile-weekly-review";
import { useProfileRank } from "@/lol/profile/use-profile-rank";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const rank = useProfileRank(account);

  return (
    <div className="flex flex-col gap-6">
      <ProfileRankTiles entries={rank.data?.rankEntries ?? []} />
      <ProfileRecentForm accountSlug={accountSlug} />
      <ProfileNowPlaying />
      <ProfileStatsBar />
      <ProfileWeeklyReview />
      <ProfileTimeHeatmap />
      <div className="grid grid-cols-2 gap-4">
        <ProfileTiltIndicator />
        <ProfileGameLength />
      </div>
      <ProfilePoolEntropy />
    </div>
  );
}
