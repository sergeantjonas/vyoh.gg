import { AmbientHero } from "@/home/ambient-hero";
import { AtmosphereProvider } from "@/home/atmosphere/atmosphere-provider";
import { ConclusionChapter } from "@/home/conclusion/conclusion-chapter";
import { LandingHeading } from "@/home/landing-heading";
import { AhriChapter } from "@/home/recap/ahri-chapter";
import { LolMomentsAggregator } from "@/home/recap/lol-moments-aggregator";
import { NextChapterCaret } from "@/home/recap/next-chapter-caret";
import { SteamChapter } from "@/home/recap/steam-chapter";
import { SteamMomentsAggregator } from "@/home/recap/steam-moments-aggregator";
import { useChapters } from "@/home/recap/use-chapters";
import { useHomeActivityIntensity } from "@/home/use-home-activity-intensity";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { routeMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
  // Skip the global scope-fade in <RootLayout> for the landing mount — the
  // landing owns its own entrance via <LandingHeading>'s editorial cascade and
  // the conclusion bands' whileInView gates.
  staticData: { ownsEntry: true },
  // Brand-only title on the landing; nested routes prefix their own scope.
  head: () =>
    routeMeta({
      title: "vyoh.gg",
      description:
        "Personal cross-platform gaming dashboard — League of Legends and Steam, in one editorial recap.",
    }),
});

function HomePage() {
  const { account } = usePrimaryAccount();
  const { data: activity } = useHomeActivityIntensity();
  const { data: chapters } = useChapters();
  // Hero-band ref is the proximity target for the hero's atmosphere claim. The
  // atmosphere layer reads its bounding rect each scroll tick to weight the
  // hero's contribution against any subsequent band's claim.
  const heroRef = useRef<HTMLElement | null>(null);
  // R-15: ConclusionChapter owns its own outerRef + palette-only
  // atmosphere claim, so the prior `conclusionRef` + AmbientHero
  // sibling claim are no longer needed at the route level. The
  // chapter's own useAssetClaim publishes the palette-only blend that
  // fades the bg back to time-of-day painterly once the user scrolls
  // past the last asset-driven chapter.
  return (
    <AtmosphereProvider>
      <div className="relative flex flex-col">
        {/* `--main-h` is written by <main>'s callback ref in __root.tsx (and kept
            current by a ResizeObserver there) — its value is <main>'s actual
            clientHeight, so subtracting 3rem (the wrapping div's `p-6` top+bottom
            padding) gives the exact content-area height. The `100dvh` fallback
            covers the impossible case where the var isn't set yet — pragmatic
            over-cover rather than a precise approximation. */}
        <section
          ref={heroRef}
          // Hero is a snap target so the page has a clean home state under
          // `scroll-snap-type: y mandatory`. Without it, the first chapter's
          // snap-align would pull the viewport away from the hero on every
          // scroll-end, making the landing un-restable.
          className="relative flex min-h-[calc(var(--main-h,100dvh)-3rem)] items-start justify-center pt-[8dvh] [scroll-snap-align:start]"
        >
          <AmbientHero bandRef={heroRef} intensity={activity?.intensity} />
          <LandingHeading />
        </section>
        <NextChapterCaret />
        {/* First recap chapter (R-2). Chapter only mounts when a primary LoL
            account is configured (so anonymous visitors don't see a
            placeholder Ahri pin). */}
        {account ? <AhriChapter account={account} /> : null}
        {/* R-12.5: LoL moments are grouped into a single multi-beat
            aggregator chapter ("Moments / where the routine cracked")
            instead of being individually pinned on the landing stream.
            The aggregator sits right after the Ahri subject so the LoL
            block reads as one editorial unit, then Steam takes over.
            Each detected moment (RANK_UP, KDA_OUTLIER, STREAK_5W/L,
            RETURN_FROM_HIATUS, MARATHON, OFF_META_PICK) renders as a
            beat inside; per-moment-type copy + accent + receipt still
            flow through the `momentCopy()` helper that lol-moment-beat
            owns. */}
        {(() => {
          const lolMoments =
            chapters?.filter(
              (c): c is typeof c & { kind: "lol-moment" } =>
                c.kind === "lol-moment" && Boolean(c.championAlias)
            ) ?? [];
          return account && lolMoments.length > 0 ? (
            <LolMomentsAggregator moments={lolMoments} account={account} />
          ) : null;
        })()}
        {/* Algorithmic chapter stream (R-4). `useChapters()` ranks Steam
            subjects by recency-decayed score; the Ahri anchor above is
            structural and not part of this list. LoL moments are now
            handled by the aggregator above; Steam moments stay
            single-pin until R-12.6 groups them. */}
        {chapters?.map((c, index) => {
          if (c.kind === "steam-subject") {
            return (
              <SteamChapter
                key={c.slug}
                appid={c.appid}
                framing={c.framing}
                // First algorithmic chapter (sits one past the Ahri anchor)
                // is critical: its hero asset gets a `<link rel="preload">`
                // injected so the bg snap-in isn't visible. Subsequent
                // chapters gate their preload on viewport proximity. R-9.
                priority={index === 0 ? "critical" : "lazy"}
              />
            );
          }
          // LoL + Steam moments handled by aggregator chapters (LoL above,
          // Steam below). Drop steam-moment descriptors out of this loop.
          return null;
        })}
        {/* R-12.6: Steam moments grouped into a single multi-beat
            aggregator ("Highlights / what stuck this season"), sitting
            after the steam-subject block to close the Steam half of the
            page. Atmosphere is palette-only (no shared hero) — the
            aggregator isn't "about" any one game; per-game identity
            flows through each beat's masthead + leading visual + tagline. */}
        {(() => {
          const steamMoments =
            chapters?.filter(
              (c): c is typeof c & { kind: "steam-moment" } => c.kind === "steam-moment"
            ) ?? [];
          return steamMoments.length > 0 ? (
            <SteamMomentsAggregator moments={steamMoments} />
          ) : null;
        })()}
        {/* R-15: conclusion as a multi-beat SUBJECT chapter about the
            owner. Closes the "subject portrait" arc that opens with
            the Ahri chapter — page reads as
            subject (Ahri) → moments → subjects (Steam) → moments → SUBJECT (you).
            Replaces the prior two snap-aligned siblings
            (conclusion-recent + conclusion-alltime) that pre-dated
            R-13's multi-beat primitive. OwnerIdentityStrip is dropped —
            the chapter masthead carries the owner identity now. The
            atmosphere palette-only claim that AmbientHero used to mount
            on conclusion-recent is also gone; ConclusionChapter
            publishes its own palette-only claim via useAssetClaim. */}
        <ConclusionChapter />
      </div>
    </AtmosphereProvider>
  );
}
