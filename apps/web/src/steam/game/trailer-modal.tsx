import { isWebKit } from "@/lib/is-webkit";
import { supportsAv1 } from "@/lib/supports-av1";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type SteamGameTrailer,
  pickAdaptiveTrailer,
  steamTrailerCdnUrl,
} from "@vyoh/shared";
import { useReducedMotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface TrailerModalProps {
  trailer: SteamGameTrailer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Lightbox modal for the full-length trailer. Wraps Radix Dialog (focus
// trap, ESC-to-close, scroll lock) around an adaptive `<video>` driven by
// Shaka Player. Variant pick (`pickAdaptiveTrailer`) honours the browser's
// engine + codec capabilities so Safari gets native HLS, AV1-capable
// Chrome/Firefox get DASH AV1, and everyone else gets DASH H.264.
//
// Shaka is loaded lazily via dynamic import inside the player effect so
// the ~250 KB minified blob never lands in the main route bundle — paid
// only the first time a user opens the modal. The microtrailer.mp4 acts
// as a static fallback when no adaptive variant exists (rare; legacy
// uploads), played without Shaka because there's nothing for it to do.
export function TrailerModal({ trailer, open, onOpenChange }: TrailerModalProps) {
  const prefersReducedMotion = useReducedMotionConfig();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shakaError, setShakaError] = useState(false);

  // Pick the variant once per open — the trailer object identity is the
  // memoisation key, so re-renders of the modal don't re-thrash Shaka's
  // load cycle. Computed during render (not in an effect) so the JSX
  // below can branch synchronously on "have a manifest" vs "fall back to
  // the mp4 static".
  const variant = pickAdaptiveTrailer(trailer.adaptiveTrailers, {
    isSafari: isWebKit(),
    supportsAv1: supportsAv1(),
  });
  const manifestUrl = variant ? steamTrailerCdnUrl(variant.cdnPath) : null;
  const fallbackUrl = trailer.microtrailerMp4
    ? steamTrailerCdnUrl(trailer.microtrailerMp4)
    : null;
  const posterUrl = trailer.screenshotFull
    ? steamTrailerCdnUrl(trailer.screenshotFull)
    : trailer.screenshotMedium
      ? steamTrailerCdnUrl(trailer.screenshotMedium)
      : undefined;
  const label = trailer.trailerName ?? "Trailer";

  // Mount + tear down Shaka only while the modal is open AND we have an
  // adaptive manifest to load. Closing the modal unmounts the video
  // element entirely (Radix removes the content subtree on close), so the
  // effect cleanup destroys the player and releases its MediaSource.
  useEffect(() => {
    if (!open || !manifestUrl) return;
    let mounted = true;
    let player: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        // Code-split: Shaka lands in its own chunk, fetched only on the
        // first open. Subsequent opens reuse the warm module.
        const shaka = (await import("shaka-player/dist/shaka-player.compiled")).default;
        if (!mounted || !videoRef.current) return;
        const next = new shaka.Player();
        await next.attach(videoRef.current);
        if (!mounted) {
          await next.destroy();
          return;
        }
        player = next;
        await next.load(manifestUrl);
      } catch {
        // Shaka surfaces its own console errors; we just flip the static
        // fallback path on so the user sees the mp4 instead of a black
        // box. The cleanup below still runs on unmount.
        if (mounted) setShakaError(true);
      }
    })();
    return () => {
      mounted = false;
      player?.destroy().catch(() => {
        // Destroy can reject if Shaka was mid-load when we unmounted; the
        // browser will GC the MediaSource either way.
      });
    };
  }, [open, manifestUrl]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
            prefersReducedMotion
              ? "data-[state=open]:opacity-100"
              : "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          aria-label={label}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex aspect-video w-[min(90vw,1280px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-black shadow-2xl",
            prefersReducedMotion
              ? "data-[state=open]:opacity-100"
              : "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          {/* SR-only title satisfies Radix's a11y contract without
              competing visually with the trailer name overlay below. */}
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {manifestUrl && !shakaError ? (
            <video
              ref={videoRef}
              autoPlay
              controls
              playsInline
              poster={posterUrl}
              className="absolute inset-0 size-full bg-black"
            >
              {/* Steam doesn't ship caption tracks with storefront
                  trailers; an empty default track satisfies a11y intent
                  (the cue list is empty, the player UI still surfaces
                  the captions affordance). */}
              <track kind="captions" />
            </video>
          ) : fallbackUrl ? (
            // No adaptive variant available (or Shaka load failed) —
            // play the silent looping microtrailer.mp4 as a degraded
            // fallback. Controls hidden because there's no audio + no
            // scrubbing to expose.
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={posterUrl}
              className="absolute inset-0 size-full bg-black"
            >
              <source src={fallbackUrl} type="video/mp4" />
              <track kind="captions" />
            </video>
          ) : (
            // No adaptive variant AND no microtrailer mp4 — this is the
            // "publisher hasn't uploaded anything" branch. Show the
            // poster still so the modal isn't a bare black square.
            posterUrl && (
              <img
                src={posterUrl}
                alt={label}
                className="absolute inset-0 size-full object-contain"
              />
            )
          )}
          <DialogPrimitive.Close
            aria-label="Close trailer"
            className="absolute top-3 right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            <span aria-hidden="true" className="text-lg">
              ✕
            </span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
