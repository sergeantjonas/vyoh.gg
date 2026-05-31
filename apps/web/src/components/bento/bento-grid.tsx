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

// `amount: 0.05` fires the cascade as soon as the very top of the bento crosses
// the viewport — even on tall first viewports the user sees the lift land
// rather than discovering an already-rendered grid. `once: true` so back-nav
// or scroll-up doesn't re-fire. `root` points at <main> (the actual scroll
// container — the document body itself never scrolls in this app) so
// IntersectionObserver measures intersection against the scrollable surface
// instead of the static window box, which would otherwise fire `whileInView`
// immediately for everything in the document.
const BENTO_VIEWPORT = {
  once: true,
  amount: 0.05,
  root: mainScrollRef,
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
