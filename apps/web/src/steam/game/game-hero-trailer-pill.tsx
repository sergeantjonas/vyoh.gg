import { cn } from "@/lib/utils";
import {
  steamMicrotrailerPosterUrl,
  steamMicrotrailerUrl,
} from "@/steam/_shared/steam-image";
import { useReducedMotionConfig } from "motion/react";
import { useState } from "react";

// Game-detail page-local opt-in for the looping microtrailer. The pill sits
// in the bottom-right of the hero banner and gates on `microtrailerWebm` —
// no pill, no video, no behavior change when Steam didn't ship a trailer.
// Default state stays static so the library → game-detail view-transition
// morph on `steam-game-${appid}-hero` always lands on the same static hero
// image; the trailer only mounts after an explicit click, which is well past
// the morph window.
//
// Why a pill instead of autoplay on mount: the hovercard already gives the
// auto-loop behavior at the deliberate-hover surface. On the detail page,
// autoplay would compete with the player's intent (they're here to read
// chips / unlock timeline / achievements), and starting a 6-second loop on
// every visit drains attention without consent.
export interface GameHeroTrailerPillProps {
  microtrailerWebm: string | null;
  microtrailerMp4: string | null;
  microtrailerPoster: string | null;
  microtrailerName: string | null;
}

export function GameHeroTrailerPill({
  microtrailerWebm,
  microtrailerMp4,
  microtrailerPoster,
  microtrailerName,
}: GameHeroTrailerPillProps) {
  const prefersReducedMotion = useReducedMotionConfig();
  const [open, setOpen] = useState(false);
  if (microtrailerWebm === null) return null;
  const webmUrl = steamMicrotrailerUrl(microtrailerWebm);
  if (webmUrl === null) return null;
  const mp4Url = microtrailerMp4 ? steamMicrotrailerUrl(microtrailerMp4) : null;
  const posterUrl = microtrailerPoster
    ? steamMicrotrailerPosterUrl(microtrailerPoster)
    : null;
  const label = microtrailerName ?? "Trailer";
  return (
    <>
      {open && (
        // Video sits between the hero img and the gradient/logo overlay.
        // The hero img keeps its `view-transition-name`, so a follow-up
        // navigation away from the page still morphs the static frame —
        // the video is a transient overlay that unmounts on dismiss. The
        // crossfade is a CSS opacity transition; under reduced-motion the
        // duration collapses to 0 so the swap is a hard cut without
        // suppressing the affordance itself.
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterUrl ?? undefined}
          aria-label={label}
          className={cn(
            "absolute inset-0 size-full object-cover",
            prefersReducedMotion
              ? "opacity-100"
              : "animate-in fade-in-0 duration-200 ease-out"
          )}
        >
          <source src={webmUrl} type="video/webm" />
          {mp4Url !== null && <source src={mp4Url} type="video/mp4" />}
        </video>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        aria-label={open ? `Hide ${label}` : `Play ${label}`}
        className="absolute right-4 bottom-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:right-6 sm:bottom-6"
      >
        <span aria-hidden="true">{open ? "✕" : "▶"}</span>
        <span>{open ? "Hide preview" : "Preview"}</span>
      </button>
    </>
  );
}
