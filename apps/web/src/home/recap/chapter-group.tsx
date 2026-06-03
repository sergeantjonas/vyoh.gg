import { type ReactNode, type Ref, forwardRef } from "react";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Logical wrapper for a stacked-beat chapter (R-13 final architecture).
 * Each child `<ChapterBeat>` is its own viewport-tall, snap-aligned section
 * — beats traverse via native CSS scroll snap rather than via scroll
 * progress through a sticky pin. That eliminates the "release tail" of
 * sticky positioning (pin.height of unsnapped scroll after the last beat)
 * which kept making the last beat feel easy to scroll past in the prior
 * pin-based model.
 *
 * Replaces `ChapterContainer` for multi-beat chapters. Single-pin chapters
 * (Ahri, moment chapters) can either keep using `ChapterContainer` or
 * migrate to a single-beat `ChapterGroup` — the shapes are equivalent for
 * the 1-beat case.
 */
function ChapterGroupImpl(
  { slug, ariaLabel, className, children }: Props,
  ref: Ref<HTMLElement>
) {
  return (
    <section
      ref={ref}
      data-chapter={slug}
      data-chapter-group=""
      aria-label={ariaLabel}
      className={["relative w-full", className].filter(Boolean).join(" ")}
    >
      {children}
    </section>
  );
}

export const ChapterGroup = forwardRef(ChapterGroupImpl);
