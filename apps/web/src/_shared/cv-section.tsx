import type { ReactNode } from "react";

// Section wrapper that defers layout + paint until the section is scroll-near.
// `content-visibility: auto` lets the browser skip rendering work for any
// section that's far offscreen, including suppressing `backdrop-filter` layer
// promotion on contained frosted tiles. The intrinsic-size hint reserves a
// height placeholder so scroll position doesn't shift as sections virtualize
// in and out. Tuned per section by approximate rendered height — slight
// under-estimate is fine, over-estimate causes visible gaps when the section
// finally paints.
//
// Used by the LoL profile route (foundation chunk 0b) and the LoL champion-
// detail panel (chunk 2). When more surfaces need this, leave the inline
// classname pattern — extracting further (e.g. accepting an `as` prop or
// merging className) is premature until the call sites need the polymorphism.
export function CvSection({
  minHeight,
  children,
}: {
  minHeight: number;
  children: ReactNode;
}) {
  return (
    <div
      className="[content-visibility:auto]"
      style={{ containIntrinsicSize: `auto ${minHeight}px` }}
    >
      {children}
    </div>
  );
}

// Bounded placeholder for a lazy boundary inside (or around) a CvSection. Keeps
// scroll position stable while the chunk loads, avoids CLS, and never paints
// chrome the section doesn't own (so no shimmer-shape mismatch when the real
// section swaps in).
export function SectionPlaceholder({ minHeight }: { minHeight: number }) {
  return <div aria-hidden style={{ minHeight }} />;
}
