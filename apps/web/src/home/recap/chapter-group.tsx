import { type ReactNode, type Ref, forwardRef } from "react";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter title card rendered sticky at the top of the
   * group. This is the chapter's editorial constant — typically the
   * eyebrow + masthead + tagline that identify the chapter. Stays
   * visible across every beat while beat content changes underneath,
   * so the reader perceives the chapter as one continuous editorial
   * unit with a fixed header rather than four independent pages.
   *
   * Rendered ONCE at the group level rather than re-mounting per beat —
   * the title card is the chapter's constant under which content swaps,
   * which keeps the masthead visually anchored as the reader scrolls
   * and lets per-beat content animations go bolder.
   */
  identity?: ReactNode;
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
 * The `identity` slot, when present, renders sticky at the top of the
 * group and stays visible across every beat in the chapter. Beats are
 * expected to leave enough top padding for the title card to live above
 * their content without collision.
 */
function ChapterGroupImpl(
  { slug, ariaLabel, className, identity, children }: Props,
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
      {identity ? (
        // Absolute wrapper that spans the whole group gives the sticky
        // child a sized containing block — sticky stays at viewport top
        // while the group is in view, scrolls with the group at its top
        // / bottom edges. `pointer-events: none` on the wrapper so the
        // overlay layer doesn't intercept clicks on beat content; the
        // identity itself re-enables `pointer-events: auto`.
        <div
          data-chapter-identity-mark=""
          className="pointer-events-none absolute inset-0 z-10"
        >
          <div className="sticky top-0">
            <div className="pointer-events-auto">{identity}</div>
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const ChapterGroup = forwardRef(ChapterGroupImpl);
