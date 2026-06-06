import { AmbientHero } from "@/home/ambient-hero";
import { AtmosphereProvider } from "@/home/atmosphere/atmosphere-provider";
import { EditorialCloser } from "@/home/conclusion/editorial-closer";
import { ConclusionFooterChips } from "@/home/conclusion/footer-chips";
import { LifetimeTotalsStrip } from "@/home/conclusion/lifetime-totals-strip";
import { NowPlayingStrip } from "@/home/conclusion/now-playing-strip";
import { RankTrajectoryStrip } from "@/home/conclusion/rank-trajectory-strip";
import { ConclusionRhythmBand } from "@/home/conclusion/rhythm-band";
import { TodayStrip } from "@/home/conclusion/today-strip";
import { LandingHeading } from "@/home/landing-heading";
import { OwnerIdentityStrip } from "@/home/owner-identity-strip";
import { AhriChapter } from "@/home/recap/ahri-chapter";
import { LolMomentsAggregator } from "@/home/recap/lol-moments-aggregator";
import { NextChapterCaret } from "@/home/recap/next-chapter-caret";
import { SteamChapter } from "@/home/recap/steam-chapter";
import { SteamMomentChapter } from "@/home/recap/steam-moment-chapter";
import { useChapters } from "@/home/recap/use-chapters";
import { useHomeActivityIntensity } from "@/home/use-home-activity-intensity";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
  // Skip the global scope-fade in <RootLayout> for the landing mount — the
  // landing owns its own entrance via <LandingHeading>'s editorial cascade and
  // the conclusion bands' whileInView gates.
  staticData: { ownsEntry: true },
});

function HomePage() {
  const { account } = usePrimaryAccount();
  const { data: activity } = useHomeActivityIntensity();
  const { data: chapters } = useChapters();
  // Hero-band ref is the proximity target for the hero's atmosphere claim. The
  // atmosphere layer reads its bounding rect each scroll tick to weight the
  // hero's contribution against any subsequent band's claim.
  const heroRef = useRef<HTMLElement | null>(null);
  // Conclusion-band ref drives the back-to-painterly fade after the last
  // chapter unpins. Mounted with a second `<AmbientHero>` claim (palette
  // only, no image) — the atmosphere layer's proximity weighting will pick
  // it over distant chapter claims once the user scrolls into the
  // conclusion zone, so the asset-driven bg fades back to time-of-day
  // painterly. AmbientHero is misnamed here but works for any palette-only
  // claim; a future rename is fine but not load-bearing.
  const conclusionRef = useRef<HTMLElement | null>(null);
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
          // R-7f steam-moment chapter — FIRST_TIME_GAME ships now,
          // ACHIEVEMENT_CLUSTER lands in R-7g (placeholder branch inside
          // the component until then). Descriptor carries `name` inline so
          // the chapter doesn't need a `useSteamGameRecap` roundtrip; the
          // hero URL is a deterministic appid-keyed proxy path.
          if (c.kind === "steam-moment") {
            return (
              <SteamMomentChapter
                key={c.slug}
                appid={c.appid}
                name={c.name}
                daysSince={c.daysSince}
                slug={c.slug}
                momentType={c.momentType}
                firstTime={c.firstTime}
                cluster={c.cluster}
              />
            );
          }
          // LoL moments handled by LolMomentsAggregator above.
          return null;
        })}
        {/* Conclusion is split across two snap-aligned siblings, each
            claiming a full viewport so the page reads as two distinct
            paged closes rather than one tall stack. `scroll-snap-stop:
            always` matches the chapter pattern above — every section is
            an exhaustive stop. Caret threads through both via
            `data-recap-chapter`; AmbientHero's palette-only claim is
            mounted on the recent section. See the recap arc's R-15 chunk
            for the planned re-evaluation against R-13's multi-beat
            primitive once that ships. */}
        <section
          ref={conclusionRef}
          data-recap-chapter="conclusion-recent"
          // "The shape" covers the section's mix of live (now-playing) +
          // rolling-24h (today) + longer-window aggregates (rhythm's
          // event-per-hour and session-length samples). "The week" was
          // wrong — the rhythm card doesn't bucket by week.
          data-chapter-label="The shape"
          className="flex min-h-[calc(var(--main-h,100dvh)-3rem)] flex-col items-stretch justify-center gap-2 [scroll-snap-align:start] [scroll-snap-stop:always]"
        >
          {/* Reuses AmbientHero as a palette-only atmosphere claim scoped to
              the conclusion ref — fades the bg back from asset-driven
              (chapters) to painterly time-of-day once the user scrolls past
              the last chapter. The hero's matching claim is now distant
              enough by proximity that this one wins. */}
          <AmbientHero bandRef={conclusionRef} intensity={activity?.intensity} />
          {/* Author signature opens the shape section as "this is who; here
              is how they play." Pairs with the trajectory's identity-
              adjacent framing further down. The closer's "— Vyoh" sign-off
              in the picture section continues to carry the identity beat
              at page close, so the alltime section doesn't lose its
              attribution. */}
          <OwnerIdentityStrip />
          {/* Live-state pulse: lands above the rhythm band when the owner
              is in a LoL queue or has Steam reporting an active game.
              Hides itself otherwise. Reads through PresenceMounts' root-
              level pollers — no extra network. */}
          <NowPlayingStrip />
          <ConclusionRhythmBand />
          {/* 30-day solo queue LP arc — sits between the longer-window
              rhythm samples and the 24h today strip as the mid-timescale
              beat of the shape section. Hides itself when the primary
              account has too little snapshot history to draw. */}
          <RankTrajectoryStrip />
          {/* Today pulse: zoomed in to "right now" — the narrowest
              time-bucketed strip in the shape section. */}
          <TodayStrip />
        </section>
        <section
          data-recap-chapter="conclusion-alltime"
          // Label avoids "Since launch" because the LifetimeTotalsStrip
          // already uses that as its eyebrow inside this section, and the
          // caret showing the same words two lines below the eyebrow read
          // as a typo. "The picture" mirrors the editorial closer's
          // sign-off ("That's the picture.") and frames the section as the
          // page's final beat.
          data-chapter-label="The picture"
          className="flex min-h-[calc(var(--main-h,100dvh)-3rem)] flex-col [scroll-snap-align:start] [scroll-snap-stop:always]"
        >
          {/* Upper region centers totals + closer in the viewport; footer
              chips pin to the bottom as colophon. */}
          <div className="flex flex-1 flex-col items-stretch justify-center gap-2">
            <LifetimeTotalsStrip />
            <EditorialCloser />
          </div>
          <ConclusionFooterChips />
        </section>
      </div>
    </AtmosphereProvider>
  );
}
