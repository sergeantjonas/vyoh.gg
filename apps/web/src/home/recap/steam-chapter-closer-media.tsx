import type { SteamScreenshotEntry } from "@vyoh/shared";

import { ScreenshotLightboxStrip } from "./screenshot-lightbox";

/**
 * Swappable visual slot for the Steam subject chapter's closer beat.
 *
 * Today: renders the screenshot lightbox strip — same shape as the prior
 * inline `<ScreenshotLightboxStrip>` call that lived directly in the
 * chapter, just behind a stable component boundary.
 *
 * R-10 substrate: this slot is the landing point for the optional trailer
 * promotion documented in the recap arc note (ADR-5 follow-up). R-10
 * swaps the slot's content to "screenshots-or-trailer" without touching
 * the chapter's beat-4 JSX or its activation lifecycle. The `active`
 * prop is wired to the multi-beat active-beat signal (beat 4 going
 * active), which is the correct autoplay trigger — pin-enter fires
 * while the title is still being read.
 */
export function SteamChapterCloserMedia({
  appid,
  screenshots,
  active,
  baseDelay = 0.05,
}: {
  appid: number;
  screenshots: SteamScreenshotEntry[];
  /**
   * Beat-active signal. Drives the per-thumb stagger when this beat
   * becomes visible; in R-10 will also gate trailer autoplay.
   */
  active: boolean;
  /** Seconds before the first thumb begins its reveal. */
  baseDelay?: number;
}) {
  if (screenshots.length === 0) return null;
  return (
    <ScreenshotLightboxStrip
      appid={appid}
      screenshots={screenshots}
      // Beat 3 owns its own viewport in the stacked-beat layout, so the
      // strip's thumbs scale up from the prior in-pin h-20 default to
      // claim the available space. h-32 ≈ 128px, sm:h-40 ≈ 160px.
      thumbClassName="h-32 sm:h-40 w-auto"
      nudged={active}
      baseDelay={baseDelay}
    />
  );
}
