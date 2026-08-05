import { routeMeta } from "@/lib/route-meta";
import { AntiPortraitSection } from "@/steam/portrait/anti-portrait-section";
import { BacklogBand } from "@/steam/portrait/backlog-band";
import { PortraitSection } from "@/steam/portrait/portrait-section";
import { portraitQueryOptions } from "@/steam/portrait/use-portrait";
import { platformMixQueryOptions } from "@/steam/use-platform-mix";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/portrait")({
  component: SteamPortraitPage,
  // Both endpoints read our own Postgres — 3.6 kB in ~15 ms and 166 B in ~2 ms
  // — and between them they answer every claim this page makes, so the whole
  // route server-renders its argument rather than a stack of spinners.
  //
  // `allSettled`, not `all`: an unhandled rejection here takes the route to a
  // 500 with no page at all (measured), which is worse than the cards
  // rendering their own unavailable state. `all` would also resolve the loader
  // the instant either failed, leaving the other's result out of the
  // dehydrated cache it had already earned.
  loader: ({ context: { queryClient } }) =>
    Promise.allSettled([
      queryClient.ensureQueryData(portraitQueryOptions()),
      queryClient.ensureQueryData(platformMixQueryOptions()),
    ]),
  head: () =>
    routeMeta({
      title: "Steam portrait · vyoh.gg",
      description:
        "What 186 owned games say about how one player actually plays: genre anchor, completion posture, and the half Steam doesn't show you.",
    }),
});

// Two halves of one argument, which is why they share a route rather than a
// band on the profile page: the Portrait says who the player is, the
// Anti-Portrait says what that leaves out, and neither reads as a verdict when
// it is one section among five. The bridge between them turns both readings
// into something to do, which only works from the middle — after the taste is
// established and before the shelf is indicted.
function SteamPortraitPage() {
  return (
    <div className="flex flex-col gap-12">
      <PortraitSection />
      <BacklogBand />
      <AntiPortraitSection />
    </div>
  );
}
