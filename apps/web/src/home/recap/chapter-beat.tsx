import type { ReactNode } from "react";

import { useChapterBeatNudge } from "./chapter-group";

/** Render-prop child: receives this beat's own nudge state. */
export type BeatRenderProp = (nudged: boolean) => ReactNode;

type Props = {
  /** Beat index within its `<ChapterGroup>` (0-based). Surfaces as `data-beat`. */
  index: number;
  /** Optional slug for selector targeting / debugging. */
  slug?: string;
  /** Optional ARIA label for the beat content wrapper. */
  ariaLabel?: string;
  /** Layout className applied to the beat content wrapper. */
  className?: string;
  children: ReactNode | BeatRenderProp;
};

/**
 * One beat in a sticky-stage chapter (see `ChapterGroup`). Renders as a
 * plain wrapper around the beat's content; the parent `ChapterGroup`
 * handles all the layout/animation orchestration (absolute positioning,
 * opacity cross-fade via view-timeline or Motion fallback, per-beat
 * nudge derivation from scroll progress).
 *
 * `nudged` (passed to the render-prop child) is supplied by `ChapterGroup`
 * via `ChapterBeatNudgeContext` and flips true once this beat scrolls
 * past its fade-in midpoint — so `ChapterReveal` cascades inside the
 * beat play when the beat becomes dominant rather than at chapter mount.
 */
export function ChapterBeat({ index, slug, ariaLabel, className, children }: Props) {
  const nudged = useChapterBeatNudge();
  const body = typeof children === "function" ? children(nudged) : children;

  return (
    <div
      data-beat-body=""
      data-beat={index}
      data-beat-slug={slug}
      aria-label={ariaLabel}
      className={["flex h-full w-full flex-col", className].filter(Boolean).join(" ")}
    >
      {body}
    </div>
  );
}
