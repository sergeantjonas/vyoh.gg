import { BACKDROP_SHELL_CLASS, BackdropPortal } from "@/_shared/backdrop/backdrop-portal";
import { useRefCountedClaim } from "@/_shared/backdrop/use-ref-counted-claim";
import { onRouteTransitionStart } from "@/lib/route-transition-bus";
import { steamPageBackgroundUrl } from "@/steam/_shared/steam-image";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { m, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SteamGameBackdropClaim = {
  appid: number;
  // Cache-buster on the page-background URL — surfaced via `SteamGameEnrichment`
  // and updated when Steam publishers refresh art. Optional because newly-owned
  // games render before the enrichment row catches up.
  assetTimestamp: number | null;
};

type SteamBackdropContextValue = {
  setClaim: (claim: SteamGameBackdropClaim) => void;
  acquire: () => () => void;
};

const SteamBackdropContext = createContext<SteamBackdropContextValue | null>(null);

const isSameClaim = (a: SteamGameBackdropClaim, b: SteamGameBackdropClaim) =>
  a.appid === b.appid && a.assetTimestamp === b.assetTimestamp;

export function SteamProfileBackdrop({ children }: { children: ReactNode }) {
  const { data: summary } = useSteamSummary();
  const prefersReducedMotion = useReducedMotion();
  const { claim: game, setClaim, acquire } = useRefCountedClaim(isSameClaim);

  const ctxValue = useMemo(() => ({ setClaim, acquire }), [setClaim, acquire]);

  return (
    <SteamBackdropContext.Provider value={ctxValue}>
      {children}
      <BackdropPortal>
        {/* Profile backdrop unmounts when a game claim is active —
            GameBackdropLayer fully covers it anyway, and keeping the
            profile video decoding behind an opaque cover wastes GPU
            (Safari's compositor flickers during the route transition
            because the video layer is repainted while the game img
            cross-fades in on top). */}
        {summary?.profileBackgroundUrl && !game ? (
          <m.div
            aria-hidden="true"
            className={BACKDROP_SHELL_CLASS}
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
            <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background/95" />
          </m.div>
        ) : null}
        {/* Always mounted; opacity is driven by the live claim. The provider's
            ref-counted lease keeps `game` non-null whenever any consumer is
            alive, so transient mount churn from StrictMode or the page-
            transition AnimatePresence doesn't cause a visible fade-out. */}
        <GameBackdropLayer claim={game} />
      </BackdropPortal>
    </SteamBackdropContext.Provider>
  );
}

// Layer that overlays the profile backdrop while the user is on a game-detail
// page. Sources Steam's store-page background through the API proxy, which
// internally tries the less-compressed `page_bg_generated_v6b.jpg` first and
// falls back to the universally available `storepagebackground` mirror.
// Opacity is driven by the live claim from the provider; internal state
// tracks the last non-null claim so the image stays painted during fade-out.
// On a real load error (proxy 502 — both upstreams missing for this title),
// `failed` flips and the layer hides so the profile backdrop reads through.
function GameBackdropLayer({ claim }: { claim: SteamGameBackdropClaim | null }) {
  const prefersReducedMotion = useReducedMotion();

  const [activeClaim, setActiveClaim] = useState<SteamGameBackdropClaim | null>(claim);
  useEffect(() => {
    if (claim) setActiveClaim(claim);
  }, [claim]);

  const activeAppid = activeClaim?.appid ?? null;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // Reset load state when the image source actually changes (different game).
  // assetTimestamp changes hit the same image, so they don't reset. Render-
  // time adjustment (React's documented pattern) avoids an unnecessary
  // effect + the corresponding "deps not read inside" lint chatter.
  const prevAppidRef = useRef(activeAppid);
  if (prevAppidRef.current !== activeAppid) {
    prevAppidRef.current = activeAppid;
    setFailed(false);
    setReady(false);
  }

  if (!activeClaim) return null;

  const src = steamPageBackgroundUrl(activeClaim.appid, activeClaim.assetTimestamp);
  const visible = claim !== null && ready && !failed;

  return (
    <m.div
      aria-hidden="true"
      className={BACKDROP_SHELL_CLASS}
      // Instant appearance, no fade. The previous 0.3s opacity ramp
      // raced the view-transition capture window on the library →
      // game-detail route nav: claim activates mid-VT, the fade-in
      // starts, the NEW-snapshot was captured at partial opacity, and
      // the morph interpolated through a flickering half-state. Showing
      // the backdrop instantly lets the VT cross-fade between OLD/NEW
      // pages handle the visual transition cleanly. The fade-out path
      // (game claim deactivating) similarly snaps off — the profile
      // backdrop's own enter animation in SteamProfileBackdrop covers
      // the gap on the way back to a non-game route.
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0 }}
    >
      {!failed && (
        <>
          <img
            src={src}
            alt=""
            onLoad={() => setReady(true)}
            onError={() => setFailed(true)}
            // Moderate blur (8px) softens the echo between this layer
            // and the destination hero banner — modern titles use
            // `library_hero.jpg` for both, so without some extra blur
            // the page-wide backdrop reads as a redundant copy.
            // Darkening is handled by the wash layers below rather than
            // a `brightness()` filter on the img — Safari treats CSS
            // `filter` as a forced compositing layer, which flickered
            // visibly during the route-transition opacity cross-fade.
            // `blur()` is the same compositing path but it's structurally
            // required for the visual treatment.
            className="size-full scale-105 object-cover blur-[8px]"
          />
          {/* Layered dim wash: flat base (replaces the previous
              `brightness-75` filter, see comment on the img) + a
              top-to-bottom gradient mirroring SteamProfileBackdrop so
              the bottom of the viewport — where page content sits — is
              darkest. GameBackdropLayer sits on top of the profile
              layer's equivalent wash, so we need our own here. */}
          <div className="absolute inset-0 bg-background/30" />
          <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background/95" />
        </>
      )}
    </m.div>
  );
}

// Window the resume covers the longest route VT we emit (240ms slide
// keyframe in styles/view-transitions.css) + a small buffer so the
// resume doesn't race the tail of the animation. Cross-section + account
// swap fire at 200ms, well inside the window.
const VT_RESUME_DELAY_MS = 360;

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

  // Pause decoding during a router-level view transition. Steady-state
  // Safari frame profiling on /steam routes showed ~70-90ms of "Other"
  // per frame coming from the video → blur filter chain, *including*
  // frames captured inside the VT snapshot. Pausing for the slide
  // window drops that to a static-image cost during the transition;
  // the visible poster frame freezes on screen and resumes from the
  // same loop offset on the other side. Tab visibility is re-checked
  // on resume so we don't fight the visibility handler above.
  useEffect(() => {
    return onRouteTransitionStart(() => {
      const video = ref.current;
      if (!video) return;
      const wasPlaying = !video.paused;
      if (wasPlaying) video.pause();
      window.setTimeout(() => {
        if (document.hidden) return;
        if (wasPlaying) void video.play().catch(() => {});
      }, VT_RESUME_DELAY_MS);
    });
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
// Warm the browser image cache with the backdrop URL ahead of navigation —
// wired into library-tile / library-row hover and focus handlers so the
// bytes are usually decoded by the time the user actually clicks. Deduped
// per URL via a module-level Set; subsequent hovers are no-ops. The proxy
// handles upstream fallback server-side, so one prefetch URL is enough.
const prefetchedBackdrops = new Set<string>();
export function prefetchSteamGameBackdrop(
  appid: number,
  assetTimestamp: number | null
): void {
  if (typeof window === "undefined") return;
  const url = steamPageBackgroundUrl(appid, assetTimestamp);
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
