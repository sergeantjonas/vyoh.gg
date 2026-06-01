import type { MotionValue } from "motion/react";
import { createContext, useContext } from "react";

// Per-chapter scroll progress (0..1) through the pin window, published by
// `<ChapterContainer>` and consumed by band primitives that drive their
// reveal animations off chapter-local progress rather than global scrollY.
//
// Bands render outside a ChapterContainer (e.g. in tests or one-off layouts)
// fall back to a frozen-at-0 MotionValue so they still behave deterministically
// — they just won't animate without a chapter container above them.
export type ChapterProgress = MotionValue<number>;

export const ChapterProgressContext = createContext<ChapterProgress | null>(null);

export function useChapterProgressContext(): ChapterProgress | null {
  return useContext(ChapterProgressContext);
}
