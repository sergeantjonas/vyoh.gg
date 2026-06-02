import { BentoGrid, BentoTile } from "@/components/bento/bento-grid";
import { AmbientHero } from "@/home/ambient-hero";
import { AtmosphereProvider } from "@/home/atmosphere/atmosphere-provider";
import { LandingHeading } from "@/home/landing-heading";
import { LandingSteamBand } from "@/home/landing-steam-band";
import { AhriChapter } from "@/home/recap/ahri-chapter";
import { NextChapterCaret } from "@/home/recap/next-chapter-caret";
import { SteamChapter } from "@/home/recap/steam-chapter";
import { useChapters } from "@/home/recap/use-chapters";
import { TileBuildBadge } from "@/home/tile-build-badge";
import { TileChronotype } from "@/home/tile-chronotype";
import { TileDaySplit } from "@/home/tile-day-split";
import { TileDomainAge } from "@/home/tile-domain-age";
import { TileLastMatch } from "@/home/tile-last-match";
import { TileSessionLengths } from "@/home/tile-session-lengths";
import { TileSignatureGame } from "@/home/tile-signature-game";
import { TileWeeklyTotals } from "@/home/tile-weekly-totals";
import { useHomeActivityIntensity } from "@/home/use-home-activity-intensity";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
  // Skip the global scope-fade in <RootLayout> for the landing mount — the
  // landing owns its own entrance via <LandingHeading>'s editorial cascade and
  // <LandingSteamBand> / <BentoGrid>'s whileInView gates.
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
        {/* First recap chapter (R-2). The bento below still renders — it
            retires in R-5 once the conclusion lands. Chapter only mounts
            when a primary LoL account is configured (so anonymous /
            visitors don't see a placeholder Ahri pin). */}
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
            user back to the last chapter on every scroll-end. This wraps
            the post-chapter zone (LandingSteamBand + bento) into a single
            snap area aligned to its start, so leaving the chapters lands
            cleanly at the top of the steam band and the bento scrolls
            naturally below. */}
        <div className="[scroll-snap-align:start]">
          <LandingSteamBand />
          <BentoGrid>
            <BentoTile width={2} height={2}>
              <TileChronotype />
            </BentoTile>
            <BentoTile width={2}>
              <TileSignatureGame account={account} />
            </BentoTile>
            <BentoTile width={2}>
              <TileLastMatch account={account} />
            </BentoTile>
            <BentoTile width={2}>
              <TileWeeklyTotals />
            </BentoTile>
            <BentoTile width={2} height={2}>
              <TileDaySplit />
            </BentoTile>
            <BentoTile width={2}>
              <TileSessionLengths />
            </BentoTile>
            <BentoTile>
              <TileBuildBadge />
            </BentoTile>
            <BentoTile>
              <TileDomainAge />
            </BentoTile>
          </BentoGrid>
        </div>
      </div>
    </AtmosphereProvider>
  );
}
