import { AmbientHero } from "@/home/ambient-hero";
import { AtmosphereProvider } from "@/home/atmosphere/atmosphere-provider";
import { EditorialCloser } from "@/home/conclusion/editorial-closer";
import { ConclusionFooterChips } from "@/home/conclusion/footer-chips";
import { LifetimeTotalsStrip } from "@/home/conclusion/lifetime-totals-strip";
import { ConclusionRhythmBand } from "@/home/conclusion/rhythm-band";
import { LandingHeading } from "@/home/landing-heading";
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
        {/* Release point for the mandatory chapter-snap region. Without a
            snap-align at the start of the post-chapter content, the
            browser's nearest-snap-target lookup would keep pulling the
            user back to the last chapter on every scroll-end. The
            conclusion sits in a single snap area aligned to its start so
            leaving the chapters lands cleanly at the top of the rhythm
            band and the rest of the conclusion scrolls naturally below. */}
        <section
          ref={conclusionRef}
          // Treated as the terminal "chapter" for `<NextChapterCaret>`
          // discovery so the caret keeps pointing forward from the last
          // Steam chapter to the conclusion (and then hides once the user
          // is past this section). Without this, the caret disappears in
          // the last chapter and the conclusion reads as undiscoverable.
          data-recap-chapter="conclusion"
          data-chapter-label="The picture"
          // Top padding gives the conclusion a clear opening beat so the
          // previous chapter's content doesn't visually bleed into the
          // rhythm band when the snap-align lands. The retired
          // LandingSteamBand previously provided this breathing room as a
          // side effect; without it the rhythm band crowds the chapter
          // exit. Tune the dvh value if the gap feels too generous.
          className="pt-[12dvh] [scroll-snap-align:start]"
        >
          {/* Reuses AmbientHero as a palette-only atmosphere claim scoped to
              the conclusion ref — fades the bg back from asset-driven
              (chapters) to painterly time-of-day once the user scrolls past
              the last chapter. The hero's matching claim is now distant
              enough by proximity that this one wins. */}
          <AmbientHero bandRef={conclusionRef} intensity={activity?.intensity} />
          <ConclusionRhythmBand />
          <LifetimeTotalsStrip />
          <EditorialCloser />
          <ConclusionFooterChips />
        </section>
      </div>
    </AtmosphereProvider>
  );
}
