import { OrbGlyph } from "@/components/orb-glyph";
import { Button } from "@/components/ui/button";
import { EditorialHeading } from "@/components/ui/editorial-heading";
import { HeroLabel } from "@/components/ui/hero-number";
import { Link } from "@tanstack/react-router";
import { m, useReducedMotion } from "motion/react";

// Editorial treatment, not a dashboard tile: a 404 is a read-once statement,
// so it gets the magazine-spread vocabulary (eyebrow → masthead → body →
// action) rather than chromed tiles. The orb — usually pinned at navbar scale
// — is given range here as the centrepiece, its halo tinting to the active
// route theme. See repo-conventions "Bento vs editorial".
export function NotFound() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center gap-8 px-6 py-20 text-center">
      <m.div
        className="relative"
        {...(!reducedMotion
          ? {
              initial: { opacity: 0, scale: 0.82, y: 12 },
              animate: { opacity: 1, scale: 1, y: 0 },
              transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
            }
          : {})}
      >
        <OrbGlyph className="size-32 sm:size-40" />
      </m.div>

      <div className="flex flex-col items-center gap-4">
        <HeroLabel className="text-muted-foreground/70">Error 404</HeroLabel>
        <EditorialHeading
          as="h1"
          magnitude="large"
          className="font-[680] text-[clamp(2rem,5vw,3.25rem)] leading-[0.95] tracking-[-0.02em] text-balance"
        >
          {["No such page.", "Not yet, anyway."]}
        </EditorialHeading>
        <p className="max-w-sm text-pretty text-sm text-muted-foreground">
          Wherever you were heading, vyoh.gg hasn't been there yet — this dashboard only
          knows the games that have actually been played.
        </p>
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
