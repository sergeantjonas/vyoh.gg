import { ChapterReveal } from "./chapter-reveal";
import { SHADOW_LABEL } from "./chapter-shadows";

/**
 * Text-only running header for stacked-beat chapters. Rendered inside each
 * non-masthead beat (typically beats 1+) so the chapter's framing — "this
 * is still the same game" — stays visible while the per-beat content carries
 * the body of the spread.
 *
 * Text-only by design: a shrunken logo next to a masthead-sized logo on
 * the prior beat reads as a ~5× shrink and undercuts the chapter's identity.
 * A tracking-wide small-caps line lives in a different visual register
 * entirely, so there's no "shrink" to feel jarring.
 *
 * Fades in with the beat's own reveal cascade — owner passes the beat's
 * `nudged` value through so the overlay appears alongside the editorial
 * content rather than as a static element waiting for the rest to arrive.
 */
export function ChapterIdentityOverlay({
  name,
  nudged,
}: {
  name: string;
  nudged: boolean;
}) {
  return (
    <div
      data-chapter-identity-overlay=""
      className="pointer-events-none absolute left-6 right-6 top-6 z-10 sm:left-10 sm:right-10"
    >
      <ChapterReveal active={nudged} delay={0.05}>
        <span
          className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/85"
          style={{ textShadow: SHADOW_LABEL }}
        >
          {name}
        </span>
      </ChapterReveal>
    </div>
  );
}
