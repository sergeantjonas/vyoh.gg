import { routeMeta } from "@/lib/route-meta";
import { LibraryCompositionChip } from "@/steam/library-composition-chip";
import { OwnedGamesChip } from "@/steam/owned-games-chip";
import { PortraitSection } from "@/steam/portrait/portrait-section";
import { portraitQueryOptions } from "@/steam/portrait/use-portrait";
import { SteamIdentityHero } from "@/steam/profile/steam-identity-hero";
import { TrophyCaseStrip } from "@/steam/profile/trophy-case-strip";
import { RecentUnlocksChip } from "@/steam/recent-unlocks-chip";
import { platformMixQueryOptions } from "@/steam/use-platform-mix";
import { WishlistChip } from "@/steam/wishlist-chip";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/")({
  component: SteamPage,
  // The Portrait's cards are the claims this page makes; everything else on it
  // is a count. Both endpoints read our own Postgres — 3.6 kB in ~15 ms and
  // 166 B in ~2 ms — so they are worth the critical path where the live Steam
  // summary beside them is not.
  //
  // `allSettled`, not `all`: an unhandled rejection here takes the whole
  // section landing page to a 500 (measured — a missing endpoint served no
  // page at all), which is worse than the cards rendering their own
  // unavailable state while the rest of the profile loads. `all` would also
  // resolve the loader the instant either one failed, leaving the other's
  // result out of the dehydrated cache it had already earned.
  loader: ({ context: { queryClient } }) =>
    Promise.allSettled([
      queryClient.ensureQueryData(portraitQueryOptions()),
      queryClient.ensureQueryData(platformMixQueryOptions()),
    ]),
  head: () =>
    routeMeta({
      title: "Steam profile · vyoh.gg",
      description:
        "Steam player portrait, trophy case, recent unlocks, and library mix on vyoh.gg.",
    }),
});

function SteamPage() {
  return (
    <div className="flex flex-col gap-6">
      <SteamIdentityHero />
      <PortraitSection />
      <TrophyCaseStrip />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RecentUnlocksChip />
        <WishlistChip />
        <LibraryCompositionChip />
        <OwnedGamesChip />
      </div>
    </div>
  );
}
