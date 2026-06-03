import { motion } from "motion/react";

import { steamLibraryLogoUrl } from "@/steam/_shared/steam-image";

import { useChapterPin } from "./chapter-container";
import { SHADOW_LABEL } from "./chapter-shadows";
import { useBeatIndex } from "./use-beat-index";

/**
 * Persistent chapter identity at the top of the pin. Renders the official
 * Steam logo when one exists (small height, ~28px), else the game name in
 * small-caps tracking. Hidden on beat 0 — that beat owns the big editorial
 * masthead, so a second logo overlay would compete with it. Fades in on
 * beats 1-3 so the chapter's framing ("this beat is still Resident Evil 4")
 * stays visible while the per-beat content carries the body of the spread.
 *
 * Positioned absolutely inside the chapter pin so it doesn't shift the
 * beat layout. Reads the active-beat index via `useBeatIndex` over the
 * same outer-section ref `<ChapterBeats>` subscribes to — two listeners
 * read the same scroll, but the cost is trivial vs the layout simplicity
 * of letting the strip live outside `<ChapterBeats>`.
 */
export function SteamChapterIdentityStrip({
  name,
  hasLogo,
  appid,
  assetTimestamp,
}: {
  name: string;
  hasLogo: boolean;
  appid: number;
  assetTimestamp: number | null;
}) {
  const { ref, beats } = useChapterPin();
  const activeIndex = useBeatIndex(ref, beats);
  const visible = activeIndex > 0;

  return (
    <motion.div
      aria-hidden={visible ? undefined : true}
      data-chapter-identity-strip=""
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className="absolute left-6 right-6 top-6 z-10 flex items-center sm:left-10 sm:right-10"
    >
      {hasLogo && assetTimestamp !== null ? (
        <img
          src={steamLibraryLogoUrl(appid, assetTimestamp)}
          alt={name}
          // Small persistent header — heights tuned so the logo reads as a
          // running-header element rather than a second editorial masthead.
          className="h-7 w-auto max-w-[200px] object-contain opacity-90 sm:h-8"
          style={{
            filter:
              "drop-shadow(0 1px 0 rgba(0,0,0,0.8)) drop-shadow(0 0 4px rgba(0,0,0,0.7))",
          }}
        />
      ) : (
        <span
          className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/85"
          style={{ textShadow: SHADOW_LABEL }}
        >
          {name}
        </span>
      )}
    </motion.div>
  );
}
