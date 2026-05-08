import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { ProfileNowPlaying } from "@/lol/profile/profile-now-playing";
import { ProfileRankTiles } from "@/lol/profile/profile-rank-tile";
import { ProfileRecentForm } from "@/lol/profile/profile-recent-form";
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

  return (
    <div className="flex flex-col gap-6">
      <ProfileRankTiles entries={rank.data?.rankEntries ?? []} />
      <ProfileRecentForm accountSlug={accountSlug} />
      <ProfileNowPlaying />
      <ProfileStatsBar />
    </div>
  );
}
