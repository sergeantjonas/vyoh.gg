import { runIdentityRectMorph } from "@/_shared/identity-morph-flip";
import { isWebKit } from "@/lib/is-webkit";
import { getNavigationType } from "@/lib/navigation-type";
import { mainScrollRef } from "@/lib/scroll-container";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import {
  STEAM_IDENTITY_AVATAR_MORPH_ID,
  STEAM_IDENTITY_NAME_MORPH_ID,
} from "./identity-layout";

// Cross-navigation identity morph for the Steam section (M2b of the nav-
// condensation arc — the Steam parallel of apps/web/src/lol/profile/
// identity-morph-nav.ts). The same avatar + persona name that the M2 scroll-
// collapse morph flies between the cinematic hero and the compact strip on
// *scroll* should also travel on *navigation*: Profile → tab lifts the big
// hero identity up into the header strip, and tab → Profile drops it back
// into the hero.
//
// Two paths share this driver:
//
// 1. VT path (Chromium + Safari-with-VT): name the source
//    `view-transition-name` synchronously so it's present at OLD-snapshot
//    capture, hand-roll a single `startViewTransition`, clear the source
//    and navigate inside the update callback, then name the freshly
//    committed destination so it's present at NEW-snapshot time.
//
// 2. Rect-FLIP fallback (Firefox + anything else without
//    `document.startViewTransition`): capture source rects pre-nav, fire
//    the navigation, and on resolution FLIP-animate the destination avatar
//    and name from those rects to their natural positions. Same mechanism
//    as match-hero / library-row / game-panel-hero's row→panel FLIP. No
//    body-level shell slide here (router VT is off on Firefox too), just
//    the per-element morph so the identity still travels visibly.
//
// One Steam-specific gate stays in both paths: bail on WebKit. Steam intra-
// section navs already bypass router VT on Safari/iOS (navigation-type.ts)
// because WebKit's VT snapshot capture is expensive on Steam-shaped DOM
// (every Library tile is an isolate stacking context with shadow,
// Achievements has a virtualized shadowed feed, etc.). Running a *second*
// hand-rolled VT or rect-FLIP here would re-introduce visible cost on the
// engine we paid the bypass to avoid. Letting WebKit fall through to the
// existing `safari-slide-in-from-*` CSS substitute is the honest outcome.

type DocumentWithVT = Document & {
  startViewTransition?: (callback: () => Promise<void>) => {
    finished?: Promise<unknown>;
    types?: Set<string>;
  };
};

interface MarkedIdentity {
  avatar: HTMLElement | null;
  name: HTMLElement | null;
}

function readMarkedIdentity(): MarkedIdentity {
  return {
    avatar: document.querySelector<HTMLElement>("[data-identity-avatar]"),
    name: document.querySelector<HTMLElement>("[data-identity-name]"),
  };
}

function setIdentityNames(els: MarkedIdentity, on: boolean): void {
  if (els.avatar)
    els.avatar.style.viewTransitionName = on ? STEAM_IDENTITY_AVATAR_MORPH_ID : "";
  if (els.name)
    els.name.style.viewTransitionName = on ? STEAM_IDENTITY_NAME_MORPH_ID : "";
}

// Sibling Steam library/$appid → tab navs are list↔detail pairs in the
// classifier and shouldn't morph the identity even on Firefox (the panel
// hero owns its own row→panel morph). Replicates the rule from
// `navigation-type.ts`'s `isSteamLibraryPair` so the rect-FLIP path doesn't
// depend on the VT-gated `getNavigationType`.
function isSteamLibraryPair(from: string, to: string): boolean {
  const inLib = (p: string) => p === "/steam/library" || p.startsWith("/steam/library/");
  return inLib(from) && inLib(to);
}

export interface SteamIdentityMorphNavOptions {
  // Resolved pathnames, e.g. `/steam/library`.
  fromPathname: string;
  toPathname: string;
  // The destination is the Steam Profile landing (`/steam`), which always has
  // an identity to morph into (the hero is the first thing on the page).
  toIsProfileIndex: boolean;
  // Pre-bound navigation to the target route, with `viewTransition: false` so
  // it doesn't nest a second router-level VT inside ours.
  navigate: () => Promise<unknown>;
}

/**
 * Run the Steam Profile↔tab identity morph for a section-tab click. Returns
 * `true` when it took over navigation (the caller should `preventDefault()`
 * the tab's `<Link>`); `false` when the morph doesn't apply and the plain
 * router slide (or Safari CSS-slide substitute) should handle the nav.
 */
export function runSteamIdentityMorphNav(opts: SteamIdentityMorphNavOptions): boolean {
  // WebKit early-bail — see the file-header comment. Falls through to the
  // existing Steam intra-section CSS slide (use-safari-slide-direction).
  if (isWebKit()) return false;

  // Same-section gate + list↔detail exclusion. These checks duplicate the
  // classification in `navigation-type.ts` so the rect-FLIP fallback can
  // run on Firefox without depending on `getNavigationType` (which gates
  // itself on VT support and returns false on Firefox).
  if (!opts.toPathname.startsWith("/steam") || !opts.fromPathname.startsWith("/steam")) {
    return false;
  }
  if (isSteamLibraryPair(opts.fromPathname, opts.toPathname)) return false;

  const source = readMarkedIdentity();
  if (!source.avatar && !source.name) return false;
  // The hero lives inside `<main>` (`[data-vt-main]`); the strip is portaled
  // into the fixed header outside it. A morph is only meaningful when a hero
  // is on one end: source-hero (Profile-at-scroll-top → tab) or destination-
  // hero (any tab → Profile). Strip→strip navs (tab→tab, or compact-Profile→
  // tab) leave the persistent header strip in place — nothing to morph.
  const sourceIsHero =
    !!source.avatar?.closest("[data-vt-main]") ||
    !!source.name?.closest("[data-vt-main]");
  if (!opts.toIsProfileIndex && !sourceIsHero) return false;

  // Capture source rects synchronously — used by the rect-FLIP fallback.
  // (VT path doesn't need them; the browser captures pixel snapshots.)
  const sourceAvatarRect = source.avatar?.getBoundingClientRect() ?? null;
  const sourceNameRect = source.name?.getBoundingClientRect() ?? null;

  const doc = document as DocumentWithVT;
  const start = supportsViewTransitions() ? doc.startViewTransition : undefined;

  if (start) {
    // VT path.
    const types = getNavigationType(
      { pathname: opts.fromPathname },
      { pathname: opts.toPathname }
    );
    const slideType =
      Array.isArray(types) && types.includes("slide-left")
        ? "slide-left"
        : Array.isArray(types) && types.includes("slide-right")
          ? "slide-right"
          : null;
    if (!slideType) return false;

    setIdentityNames(source, true);
    // Drive the section slide ourselves (router VT is opted out on this nav).
    document.body.dataset.vtShell = "on";
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;

    const transition = start.call(doc, async () => {
      // Clear the source name before the destination mounts so the NEW
      // snapshot never sees two elements sharing one name (the about-to-
      // unmount source and the destination).
      setIdentityNames(source, false);
      await opts.navigate();
      // Name the freshly committed destination identity so it's present
      // when the browser captures the NEW snapshot (after this callback
      // resolves). No rAF wait — see LoL driver's note: awaiting rAF
      // inside the update callback deadlocks the transition.
      setIdentityNames(readMarkedIdentity(), true);
    });

    transition?.types?.add(slideType);
    void Promise.resolve(transition?.finished)
      .catch(() => {})
      .finally(() => {
        document.body.dataset.vtShell = "off";
        setIdentityNames(readMarkedIdentity(), false);
        setIdentityNames(source, false);
      });

    return true;
  }

  // Rect-FLIP fallback (Firefox + any engine without VT). Fire the
  // navigation, then FLIP the destination avatar + name from their pre-nav
  // source positions. No body-level shell slide on Firefox either; this
  // mirrors what the VT path does for the identity elements specifically
  // and leaves the rest of the page to commit instantly.
  if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
  runIdentityRectMorph({
    sourceAvatarRect,
    sourceNameRect,
    navigate: opts.navigate,
    readDest: readMarkedIdentity,
  });
  return true;
}
