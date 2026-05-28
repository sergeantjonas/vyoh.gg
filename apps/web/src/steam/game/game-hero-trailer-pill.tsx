import type { SteamGameTrailer } from "@vyoh/shared";
import { Suspense, lazy, useState } from "react";

// Lazy-load the modal subtree (which pulls Shaka via dynamic import inside
// its player effect — see trailer-modal.tsx). The pill itself stays in the
// main game-detail chunk so the affordance is decided at first paint, but
// the player infrastructure waits until the user actually clicks.
const TrailerModal = lazy(() =>
  import("./trailer-modal").then((m) => ({ default: m.TrailerModal }))
);

// Game-detail page-local entry point into the full-trailer modal. Self-gates
// on `trailer` — no pill, no behavior change when Steam didn't ship a
// playable trailer for this game. Anchored to the hero wrapper (which
// carries the view-transition name) so the pill participates in the same
// VT snapshot as the hero img.
//
// Earlier iteration of this component crossfaded the hero in-place to the
// looping microtrailer. The follow-up arc replaced that with the modal —
// the modal carries audio, adaptive streaming, native controls, and a
// large viewport, all of which the in-place crossfade couldn't. The
// affordance and placement stay so the muscle memory carries over.
export interface GameHeroTrailerPillProps {
  trailer: SteamGameTrailer | null;
}

export function GameHeroTrailerPill({ trailer }: GameHeroTrailerPillProps) {
  const [open, setOpen] = useState(false);
  if (trailer === null) return null;
  const label = trailer.trailerName ?? "Trailer";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Play ${label}`}
        className="absolute right-4 bottom-4 z-10 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:right-6 sm:bottom-6"
      >
        <span aria-hidden="true">▶</span>
        <span>Preview</span>
      </button>
      {/* Mount the modal subtree only while it's open — Suspense covers
          the dynamic-import chunk fetch on the first click per session.
          Closing unmounts the modal entirely, which destroys the Shaka
          player and releases its MediaSource (see trailer-modal.tsx). */}
      {open && (
        <Suspense fallback={null}>
          <TrailerModal trailer={trailer} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
