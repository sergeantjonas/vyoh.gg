import { routeMeta } from "@/lib/route-meta";
import { LibraryCompositionChip } from "@/steam/library-composition-chip";
import { OwnedGamesChip } from "@/steam/owned-games-chip";
import { PlatformMixChip } from "@/steam/platform-mix-chip";
import { PortraitSection } from "@/steam/portrait/portrait-section";
import { portraitQueryOptions } from "@/steam/portrait/use-portrait";
import { SteamIdentityHero } from "@/steam/profile/steam-identity-hero";
import { TrophyCaseStrip } from "@/steam/profile/trophy-case-strip";
import { RecentUnlocksChip } from "@/steam/recent-unlocks-chip";
import { WishlistChip } from "@/steam/wishlist-chip";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/")({
  component: SteamPage,
  // The Portrait's claims are what this page says; everything else on it is a
  // count. 3.6 kB answered from our own Postgres in ~15 ms, so it is worth the
  // critical path where the live Steam summary next to it is not.
  //
  // Swallowed on purpose: an unhandled rejection here takes the whole section
  // landing page to a 500 (measured — a missing endpoint returned no page at
  // all), which is a worse answer than the identity cards rendering their own
  // unavailable state while the rest of the profile still loads. Priming is an
  // optimisation, so it must not be able to fail the route.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(portraitQueryOptions()).catch(() => undefined),
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
        <PlatformMixChip />
      </div>
    </div>
  );
}
