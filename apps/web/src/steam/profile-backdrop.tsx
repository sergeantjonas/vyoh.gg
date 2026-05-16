import { useSteamSummary } from "@/steam/use-steam-summary";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function SteamProfileBackdrop() {
  const { data: summary } = useSteamSummary();
  const prefersReducedMotion = useReducedMotion();

  if (!summary?.profileBackgroundUrl || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    // Fade the backdrop in on mount instead of having it pop in the moment
    // `summary` resolves — the network round-trip means the image/video
    // appears noticeably after first paint, which reads as jarring without
    // the easing.
    <m.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }
      }
    >
      {summary.profileBackgroundVideoUrl && !prefersReducedMotion ? (
        <BackdropVideo
          src={summary.profileBackgroundVideoUrl}
          poster={summary.profileBackgroundUrl}
        />
      ) : (
        <img
          src={summary.profileBackgroundUrl}
          alt=""
          className="size-full scale-105 object-cover blur-[2px]"
        />
      )}
      {/* Gradient mask anchored heavier at the bottom so the page content
          cards stay focal. Mirrors the LoL splash gradient shape. The bottom
          stop is /95 (not /100) so a hint of image texture survives below
          the cards instead of fading to flat dark. */}
      <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background/95" />
    </m.div>,
    document.body
  );
}

function BackdropVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  // Pause decoding when the tab is hidden — the video is purely decorative,
  // and continuing to decode frames into a backgrounded tab pins meaningful
  // GPU memory (frame buffers + WebRender backing surface for the blur)
  // for nobody to see. Re-entering plays back from the current loop offset.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (document.hidden) video.pause();

    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return (
    <video
      ref={ref}
      key={src}
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      className="size-full scale-105 object-cover blur-[2px]"
    />
  );
}
