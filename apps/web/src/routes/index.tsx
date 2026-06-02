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
import { NextChapterCaret } from "@/home/recap/next-chapter-caret";
import { SteamChapter } from "@/home/recap/steam-chapter";
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
        {/* Algorithmic chapter stream (R-4). `useChapters()` ranks Steam
            subjects by recency-decayed score; the Ahri anchor above is
            structural and not part of this list. Non-`steam-subject` kinds
            (LoL moments, Steam moments) land in R-6 / R-7. */}
        {chapters?.map((c) =>
          c.kind === "steam-subject" ? (
            <SteamChapter key={c.slug} appid={c.appid} framing={c.framing} />
          ) : null
        )}
        {/* Conclusion is split across two snap-aligned siblings so the
            page reads as two viewport-paged closes rather than one tall
            stack that overflows under the snap-paged flow above. Caret
            threads through both via `data-recap-chapter`; AmbientHero's
            palette-only claim is mounted on the recent section (its
            bounding rect anchors atmosphere proximity for the whole
            conclusion zone — the alltime section is close enough that
            adding a second claim would just be redundant). See the recap
            arc's R-15 chunk for the planned re-evaluation against R-13's
            multi-beat primitive once that ships. */}
        <section
          ref={conclusionRef}
          data-recap-chapter="conclusion-recent"
          data-chapter-label="The week"
          // Small top padding gives the section a visible opening beat
          // when the snap-align lands without parking a full chapter of
          // empty atmosphere above the rhythm band. Chapters use
          // `pinViewports={1}` + `scroll-snap-stop: always`, so at rest the
          // previous chapter is fully off-screen above — the padding is for
          // visual breathing during the transition, not bleed prevention.
          className="pt-[5dvh] [scroll-snap-align:start]"
        >
          {/* Reuses AmbientHero as a palette-only atmosphere claim scoped to
              the conclusion ref — fades the bg back from asset-driven
              (chapters) to painterly time-of-day once the user scrolls past
              the last chapter. The hero's matching claim is now distant
              enough by proximity that this one wins. */}
          <AmbientHero bandRef={conclusionRef} intensity={activity?.intensity} />
          {/* Live-state pulse: lands above the rhythm band when the owner
              is in a LoL queue or has Steam reporting an active game.
              Hides itself otherwise so the section opens with the rhythm
              band. Reads through PresenceMounts' root-level pollers — no
              extra network. */}
          <NowPlayingStrip />
          <ConclusionRhythmBand />
          {/* Today pulse: zoomed in to "right now" — sits adjacent to the
              weekly rhythm band as the second time-bucketed strip. */}
          <TodayStrip />
        </section>
        <section
          data-recap-chapter="conclusion-alltime"
          data-chapter-label="Since launch"
          className="pt-[5dvh] [scroll-snap-align:start]"
        >
          {/* Author signature: introduces the alltime self-portrait. The
              orb opens the page; the named author signs into the alltime
              totals. */}
          <OwnerIdentityStrip />
          {/* 30-day solo queue LP arc — sits between the identity signature
              and alltime totals as the "where the climb is going right now"
              beat. Hides itself when the primary account has too little
              snapshot history to draw. */}
          <RankTrajectoryStrip />
          <LifetimeTotalsStrip />
          <EditorialCloser />
          <ConclusionFooterChips />
        </section>
      </div>
    </AtmosphereProvider>
  );
}
