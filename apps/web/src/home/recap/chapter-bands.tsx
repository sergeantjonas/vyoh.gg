import type { ReactNode } from "react";

// Recap chapters compose four named bands. Each one is a thin slotted
// container that owns its layout role (opener / detail / stats / closer)
// and exposes a `data-band` attribute so consumers and tests can target it
// without coupling to className internals.
//
// These are deliberately layout-only — no motion, no claim plumbing. The
// reveal is driven by `ChapterReveal` wrappers via motion's `whileInView`,
// fired per-band as each band enters the viewport. Primitives don't impose
// a specific reveal shape so individual chapters (Ahri vs Steam game vs
// moment) can choose what their opener / detail / stats / closer look like.

type Slot = "opener" | "detail" | "stats" | "closer";

type Props = {
  className?: string;
  children: ReactNode;
};

function bandClassName(slot: Slot, extra?: string): string {
  // Editorial defaults: opener gets generous breathing room; detail rows
  // stack tight; stats live in a horizontal strip; closer is centered with
  // the page paragraph width so screenshots/trailers can frame against it.
  // Internal vertical padding is the breathing room that makes the chapter
  // read as editorial; stripping it (tried in an R-3 polish round) made
  // bands collide and lost the magazine-spread quality. Override only
  // where a specific chapter truly needs different spacing.
  const slotClass = {
    opener: "flex flex-col gap-3 pt-12 pb-6",
    detail: "flex flex-col gap-2 py-4",
    stats: "flex flex-row flex-wrap items-baseline gap-6 py-4",
    closer: "flex flex-col items-center gap-4 pt-6 pb-12",
  }[slot];
  return ["w-full", slotClass, extra].filter(Boolean).join(" ");
}

/** Top band of a chapter — eyebrow + title + lede metric. */
export function ChapterOpener({ className, children }: Props) {
  return (
    <div data-band="opener" className={bandClassName("opener", className)}>
      {children}
    </div>
  );
}

/** Middle band — recent rows (matches, unlocks, etc.) revealed one-by-one. */
export function ChapterDetail({ className, children }: Props) {
  return (
    <div data-band="detail" className={bandClassName("detail", className)}>
      {children}
    </div>
  );
}

/** Stat strip — trend numbers, percentile chips, draw-in progress bars. */
export function ChapterStats({ className, children }: Props) {
  return (
    <div data-band="stats" className={bandClassName("stats", className)}>
      {children}
    </div>
  );
}

/** Closing band — signature beat, screenshots rotator, link to deep route. */
export function ChapterCloser({ className, children }: Props) {
  return (
    <div data-band="closer" className={bandClassName("closer", className)}>
      {children}
    </div>
  );
}
