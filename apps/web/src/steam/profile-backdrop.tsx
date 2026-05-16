import {
  steamPageBackgroundGeneratedUrl,
  steamPageBackgroundUrl,
} from "@/steam/_shared/steam-image";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { m, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type SteamGameBackdropClaim = {
  appid: number;
  // Cache-buster on the page-background URL — surfaced via `SteamGameEnrichment`
  // and updated when Steam publishers refresh art. Optional because newly-owned
  // games render before the enrichment row catches up.
  assetTimestamp: number | null;
};

type SteamBackdropContextValue = {
  // Reference-counted lease. The hook calls `acquire()` on mount and the
  // returned `release()` on unmount; the provider only nulls the claim when
  // the live-consumer count hits zero. This is essential because the page-
  // transition `<AnimatePresence>` in `<SectionShell>` keeps the previous
  // route's `<m.div>` mounted during the slide — both the exiting and
  // entering `<m.div>` render `{children} = <Outlet />`, and both Outlets
  // resolve to the current matched route, so the game page mounts twice
  // during the navigation. When the exiting instance later unmounts, an
  // un-counted `setClaim(null)` would null the backdrop even though the
  // surviving instance is still alive — surfacing as the backdrop fading
  // back to the profile right after it appeared. Ref-counting makes the
  // unmount-from-stale-instance a no-op.
  setClaim: (claim: SteamGameBackdropClaim) => void;
  acquire: () => () => void;
};

const SteamBackdropContext = createContext<SteamBackdropContextValue | null>(null);

export function SteamProfileBackdrop({ children }: { children: ReactNode }) {
  const { data: summary } = useSteamSummary();
  const prefersReducedMotion = useReducedMotion();
  const [game, setGameState] = useState<SteamGameBackdropClaim | null>(null);

  const liveCountRef = useRef(0);

  const setClaim = useCallback((claim: SteamGameBackdropClaim) => {
    setGameState((prev) => {
      if (
        prev &&
        prev.appid === claim.appid &&
        prev.assetTimestamp === claim.assetTimestamp
      ) {
        return prev;
      }
      return claim;
    });
  }, []);

  const acquire = useCallback(() => {
    liveCountRef.current += 1;
    return () => {
      liveCountRef.current -= 1;
      if (liveCountRef.current === 0) setGameState(null);
    };
  }, []);

  const ctxValue = useMemo(() => ({ setClaim, acquire }), [setClaim, acquire]);

  if (typeof document === "undefined") {
    return (
      <SteamBackdropContext.Provider value={ctxValue}>
        {children}
      </SteamBackdropContext.Provider>
    );
  }

  return (
    <SteamBackdropContext.Provider value={ctxValue}>
      {children}
      {createPortal(
        <>
          {summary?.profileBackgroundUrl ? (
            <m.div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.6, ease: "easeOut" }
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
              <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background/95" />
            </m.div>
          ) : null}
          {/* Always mounted; opacity is driven by the live claim. Ref-counted
              acquire/release in the provider keeps `game` non-null whenever
              any consumer is alive, so transient mount churn from StrictMode
              or the page-transition AnimatePresence doesn't cause a visible
              fade-out. */}
          <GameBackdropLayer claim={game} />
        </>,
        document.body
      )}
    </SteamBackdropContext.Provider>
  );
}

// Layer that overlays the profile backdrop while the user is on a game-detail
// page. Sources Steam's store-page background — the same image the appdetails
// endpoint exposes as `background` / `background_raw`. Opacity is driven by
// the live claim from the provider.
//
// Internal state tracks the last non-null claim so the image stays painted
// during fade-out (legitimate releases from the ref-counted provider). Many
// titles don't ship the asset; on a wsrv silent-404 (`naturalWidth === 0`)
// or a real onError, `failed` flips and the layer hides — the underlying
// profile backdrop shows through unchanged.
function GameBackdropLayer({ claim }: { claim: SteamGameBackdropClaim | null }) {
  const prefersReducedMotion = useReducedMotion();

  const [activeClaim, setActiveClaim] = useState<SteamGameBackdropClaim | null>(claim);
  useEffect(() => {
    if (claim) setActiveClaim(claim);
  }, [claim]);

  const activeAppid = activeClaim?.appid ?? null;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Two-source chain: try the less-compressed `page_bg_generated_v6b.jpg`
  // first; on miss (wsrv silent-404 or onError) swap to the universally-
  // available `storepagebackground`. On miss of that too, `failed` hides
  // the layer and the profile backdrop reads through unchanged.
  const [sourceVariant, setSourceVariant] = useState<"generated" | "store">("generated");

  // Reset load state when the image source actually changes (different game).
  // assetTimestamp changes hit the same image, so they don't reset. Render-
  // time adjustment (React's documented pattern) avoids an unnecessary
  // effect + the corresponding "deps not read inside" lint chatter.
  const prevAppidRef = useRef(activeAppid);
  if (prevAppidRef.current !== activeAppid) {
    prevAppidRef.current = activeAppid;
    setFailed(false);
    setReady(false);
    setSourceVariant("generated");
  }

  const onSourceMiss = () => {
    if (sourceVariant === "generated") {
      setSourceVariant("store");
      setReady(false);
    } else {
      setFailed(true);
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) onSourceMiss();
    else setReady(true);
  };

  if (!activeClaim) return null;

  const src =
    sourceVariant === "generated"
      ? steamPageBackgroundGeneratedUrl(activeClaim.appid, activeClaim.assetTimestamp)
      : steamPageBackgroundUrl(activeClaim.appid, activeClaim.assetTimestamp);
  const visible = claim !== null && ready && !failed;

  return (
    <m.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }
      }
    >
      {!failed && (
        <img
          src={src}
          alt=""
          onLoad={handleLoad}
          onError={onSourceMiss}
          className="size-full scale-105 object-cover blur-[5px]"
        />
      )}
    </m.div>
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

// Claim the page backdrop for a specific Steam game. Releases on unmount and
// fades back to the profile backdrop once no consumer is alive. Must be used
// inside a SteamProfileBackdrop provider.
//
// Two effects on purpose. `acquire` runs once per real mount and its returned
// `release` runs once per real unmount — it does NOT re-run when `appid` or
// `assetTimestamp` change, so live-count tracking stays accurate. `setClaim`
// runs every time the claim shape changes (typical case: page mounts with a
// null timestamp, then the owned-games query supplies the cache-buster).
// Warm the browser image cache with the v6b backdrop URL ahead of navigation
// — wired into library-tile / library-row hover and focus handlers so the
// bytes are usually decoded by the time the user actually clicks. Deduped
// per URL via a module-level Set; subsequent hovers are no-ops. Only the
// primary (v6b) source is prefetched — for titles that fall back to
// `storepagebackground`, we'd just be guessing wrong half the time.
const prefetchedBackdrops = new Set<string>();
export function prefetchSteamGameBackdrop(
  appid: number,
  assetTimestamp: number | null
): void {
  if (typeof window === "undefined") return;
  const url = steamPageBackgroundGeneratedUrl(appid, assetTimestamp);
  if (prefetchedBackdrops.has(url)) return;
  prefetchedBackdrops.add(url);
  const img = new Image();
  img.src = url;
}

export function useSteamGameBackdrop({ appid, assetTimestamp }: SteamGameBackdropClaim) {
  const ctx = useContext(SteamBackdropContext);
  if (!ctx) {
    throw new Error("useSteamGameBackdrop must be used within SteamProfileBackdrop");
  }

  useEffect(() => ctx.acquire(), [ctx]);

  useEffect(() => {
    ctx.setClaim({ appid, assetTimestamp });
  }, [ctx, appid, assetTimestamp]);
}
