import {
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import { mainScrollRef } from "@/lib/scroll-container";
import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Inline `will-change` as a Tailwind arbitrary utility — pinning the layer
// pre-promotes the tile so Firefox doesn't re-raster sub-pixel content as the
// blur clears + Y settles. Mirrors the inline `style.willChange` pattern used
// on per-line spans inside <EditorialHeading>, but expressed as a class so we
// don't have to merge MotionStyle/CSSProperties shapes on a consumer-style prop.
const TILE_WILL_CHANGE_CLASS = "[will-change:transform,opacity,filter]";

export type TileWidth = 1 | 2;
export type TileHeight = 1 | 2;

const COL_SPAN: Record<TileWidth, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
};
const ROW_SPAN: Record<TileHeight, string> = {
  1: "sm:row-span-1",
  2: "sm:row-span-2",
};

// The bento sits below the hero + steam band, so its top edge enters <main>'s
// clip as soon as the user starts scrolling. Without the negative bottom
// `margin`, the cascade fires while the user is still looking at the steam
// band, which means the bottom tiles finish their entrance off-screen and
// settle into view in their already-resting state. Shrinking the observer's
// effective root by 30% from the bottom delays the trigger until the bento
// top is past the 70%-of-viewport line — by then the user is looking at the
// grid and sees the whole cascade play out. `once: true` keeps it from
// re-firing on scroll-up. `root: mainScrollRef` anchors the IO to <main>
// (the actual scroll container — the document body itself never scrolls).
const BENTO_VIEWPORT = {
  once: true,
  amount: 0.05,
  root: mainScrollRef,
  margin: "0px 0px -30% 0px",
} as const;

export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const containerVariants = reducedMotion
    ? sectionReducedContainerVariants
    : sectionContainerVariants;

  return (
    <m.div
      data-slot="bento-grid"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-[minmax(11rem,auto)] lg:grid-cols-4",
        className
      )}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={BENTO_VIEWPORT}
    >
      {children}
    </m.div>
  );
}

export function BentoTile({
  width = 1,
  height = 1,
  children,
  className,
}: {
  width?: TileWidth;
  height?: TileHeight;
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  // The grid drives the cascade via the parent's `visible` label; each tile
  // inherits it through the variant tree. Reduced motion renders the tile
  // statically (parent already supplies the opacity-only fade as one block).
  return (
    <m.div
      data-slot="bento-tile"
      className={cn(
        "min-h-0",
        COL_SPAN[width],
        ROW_SPAN[height],
        !reducedMotion && TILE_WILL_CHANGE_CLASS,
        className
      )}
      {...(reducedMotion ? {} : { variants: sectionChildVariants.tile })}
    >
      {children}
    </m.div>
  );
}
