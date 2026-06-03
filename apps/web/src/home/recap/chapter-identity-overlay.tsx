import type { ReactNode } from "react";

import { ChapterReveal } from "./chapter-reveal";

/**
 * Persistent running header for stacked-beat chapters. Provides the
 * positioning + entrance — children are the identity mark itself (logo
 * image, champion icon, text fallback, whatever the chapter wants).
 *
 * Lives inside each non-masthead beat, since the active beat owns its
 * own scroll-snap section. Beat 0 doesn't render this (the big editorial
 * masthead lives there); beats 1+ render it with the same content so it
 * reads as a persistent header across the chapter's beats.
 *
 * Fades in alongside the beat's own reveal cascade — owner passes the
 * beat's `nudged` value through so the overlay appears with the editorial
 * content rather than as a static element waiting for the rest to arrive.
 */
export function ChapterIdentityOverlay({
  nudged,
  children,
}: {
  nudged: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-chapter-identity-overlay=""
      className="pointer-events-none absolute left-6 right-6 top-6 z-10 sm:left-10 sm:right-10"
    >
      <ChapterReveal active={nudged} delay={0.05}>
        {children}
      </ChapterReveal>
    </div>
  );
}
