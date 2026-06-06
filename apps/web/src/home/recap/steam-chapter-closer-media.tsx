import { useReducedMotionConfig } from "motion/react";
import { useEffect, useRef } from "react";

import type { SteamScreenshotEntry } from "@vyoh/shared";

import {
  steamMicrotrailerPosterUrl,
  steamMicrotrailerUrl,
} from "@/steam/_shared/steam-image";

import { ScreenshotLightboxStrip } from "./screenshot-lightbox";

/**
 * Swappable visual slot for the Steam subject chapter's closer beat.
 *
 * When a microtrailer is present and the environment allows motion +
 * isn't bandwidth-constrained, renders a looping silent video that
 * autoplays once the beat becomes active. Falls back to the existing
 * screenshot lightbox strip when:
 *   - the game has no microtrailer (most do; the upstream enrichment
 *     populates the field for a minority of titles), OR
 *   - the user prefers reduced motion (a 6-second loop reads as motion
 *     even though no scroll-coupling is involved), OR
 *   - the connection's `saveData` flag is set or its `effectiveType`
 *     indicates a 2g/3g link (the trailer is ~1–2 MB; not worth burning
 *     a mobile data budget on a chapter closer).
 *
 * Reuses the existing microtrailer pipeline (`steamMicrotrailerUrl` +
 * `steamMicrotrailerPosterUrl`) rather than introducing a parallel
 * `movies[]` fetch — per the recap arc's ADR-5 follow-up note. The
 * microtrailer is editorially honest as a chapter closer: it's a
 * 6-second silent loop teaser, not a marketing-grade full trailer. The
 * masthead's click-through to `/steam/game/$appid` already opens the
 * full trailer surface for users who want the longer cut.
 *
 * Autoplay lifecycle keys on the per-beat `active` prop (provided by
 * the multi-beat container's per-beat nudge). When the beat enters
 * focus, `play()` fires; when the user scrubs past or back, `pause()`
 * + reset to first frame so the next entry starts clean.
 */
export function SteamChapterCloserMedia({
  appid,
  screenshots,
  microtrailerWebm,
  microtrailerMp4,
  microtrailerPoster,
  microtrailerName,
  active,
  baseDelay = 0.05,
}: {
  appid: number;
  screenshots: SteamScreenshotEntry[];
  /** Steam-format microtrailer paths. All four are null when the game
   *  has no trailer in the enrichment row. */
  microtrailerWebm: string | null;
  microtrailerMp4: string | null;
  microtrailerPoster: string | null;
  microtrailerName: string | null;
  /**
   * Beat-active signal from the multi-beat parent. Drives both the
   * per-thumb stagger for the screenshot fallback AND microtrailer
   * autoplay — pin-enter fires while the chapter title is still being
   * read; beat-active is the correct moment to start playback so the
   * trailer doesn't burn its first half-second of motion while the user
   * is still reading prior beats.
   */
  active: boolean;
  /** Seconds before the first thumb begins its reveal (fallback path). */
  baseDelay?: number;
}) {
  // `useReducedMotionConfig` (not `useReducedMotion`) so a parent
  // `<MotionConfig reducedMotion="always">` in tests / opt-in surfaces
  // still wins over the OS preference.
  const prefersReducedMotion = useReducedMotionConfig();
  const trailerWebmUrl = microtrailerWebm ? steamMicrotrailerUrl(microtrailerWebm) : null;
  const trailerMp4Url = microtrailerMp4 ? steamMicrotrailerUrl(microtrailerMp4) : null;
  const trailerPosterUrl = microtrailerPoster
    ? steamMicrotrailerPosterUrl(microtrailerPoster)
    : null;
  const hasTrailer = trailerWebmUrl !== null;
  const dataAware = isDataSaver();
  const showTrailer = hasTrailer && !prefersReducedMotion && !dataAware;

  if (!showTrailer) {
    // Fallback path — same shape as the pre-R-10 slot.
    if (screenshots.length === 0) return null;
    return (
      <ScreenshotLightboxStrip
        appid={appid}
        screenshots={screenshots}
        nudged={active}
        baseDelay={baseDelay}
      />
    );
  }

  return (
    <TrailerLoop
      webmUrl={trailerWebmUrl ?? ""}
      mp4Url={trailerMp4Url}
      posterUrl={trailerPosterUrl}
      name={microtrailerName}
      active={active}
    />
  );
}

/**
 * Inner component for the trailer path. Lifted so the `<video>` ref +
 * play/pause effect don't re-mount when the outer slot's fallback
 * branch flips (e.g. data-saver toggling mid-session would otherwise
 * stop+remount the video element).
 */
function TrailerLoop({
  webmUrl,
  mp4Url,
  posterUrl,
  name,
  active,
}: {
  webmUrl: string;
  mp4Url: string | null;
  posterUrl: string | null;
  name: string | null;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Autoplay / pause on beat-active flips. Pausing on inactive also
  // resets `currentTime` to 0 so the next entry starts at the first
  // frame — without this, scrubbing past then back would replay from
  // wherever the trailer was when the user last left it, which reads
  // odd against the chapter's "start of the closer" framing.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      // Some engines reject `play()` if it overlaps with a pending
      // load. Catching the AbortError keeps the console clean — a
      // rejected play() is harmless because the next `active` flip
      // will re-trigger.
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active]);

  return (
    <div className="relative w-full overflow-hidden rounded-md bg-black/40">
      {/* 16:9 aspect via padding-trick — matches Steam's storefront
          microtrailer ratio (the source files are encoded for 16:9
          tiles). Lets the chapter slot expand to full width without
          a fixed pixel height. */}
      <div className="aspect-video w-full">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterUrl ?? undefined}
          aria-label={name ?? ""}
          className="h-full w-full object-cover"
        >
          <source src={webmUrl} type="video/webm" />
          {mp4Url !== null && <source src={mp4Url} type="video/mp4" />}
        </video>
      </div>
    </div>
  );
}

/**
 * Returns true when the browser indicates the user is on a data-saver
 * connection (`saveData: true`) or a 2g/3g link (`effectiveType`). The
 * Network Information API is non-standard but widely supported on
 * Chromium-family browsers — the only ones where a mobile-data user
 * would land via service-worker preload anyway. Safari + Firefox return
 * `undefined`, in which case we default to "allow" (don't block desktop
 * users on the absence of a heuristic).
 */
function isDataSaver(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!conn) return false;
  if (conn.saveData === true) return true;
  if (conn.effectiveType === "slow-2g") return true;
  if (conn.effectiveType === "2g") return true;
  if (conn.effectiveType === "3g") return true;
  return false;
}

// Minimal shape of the Network Information API used above. TypeScript's
// `lib.dom.d.ts` doesn't ship this; declaring locally avoids adding a
// dependency just for one property check.
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}
