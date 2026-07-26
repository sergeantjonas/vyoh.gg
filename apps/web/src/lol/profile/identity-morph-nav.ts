import { runIdentityRectMorph } from "@/_shared/identity-morph-flip";
import { getNavigationType } from "@/lib/navigation-type";
import { mainScrollRef } from "@/lib/scroll-container";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { IDENTITY_AVATAR_MORPH_ID, IDENTITY_NAME_MORPH_ID } from "./identity-layout";

// Cross-navigation identity morph for the LoL section (M2b of the nav-
// condensation arc). The same avatar + name that the M2 scroll-collapse morph
// flies between the cinematic hero and the compact strip on *scroll* should
// also travel on *navigation*: Profile → tab lifts the big hero identity up
// into the header strip, and tab → Profile drops it back down into the hero.
//
// Two paths share this driver:
//
// 1. VT path (Chromium + Safari-with-VT): the repo's proven nav-morph idiom
//    is imperative (match-row, champion-table, library-row) — name the source
//    `view-transition-name` synchronously so it's present at OLD-snapshot
//    capture, hand-roll a single `startViewTransition`, clear the source and
//    navigate inside it, then let the destination carry the matching name at
//    NEW-snapshot time. The persistent header strip means we can't name the
//    destination declaratively (a permanent name would attach on every slide
//    and pull the strip out of the shell snapshot), so both ends are named
//    imperatively from the `[data-identity-{avatar,name}]` markers.
//
// 2. Rect-FLIP fallback (Firefox + anything else without
//    `document.startViewTransition`): capture source rects pre-nav, fire the
//    navigation, and on resolution FLIP-animate the destination avatar and
//    name from those rects to their natural positions. Same mechanism as
//    match-hero / library-row / game-panel-hero's row→panel FLIP. No body-
//    level shell slide here (router VT is off on Firefox too), just the
//    per-element morph so the identity still travels visibly.
//
// On the VT path the morph runs *alongside* the section slide: we set
// `data-vt-shell="on"` + reset `<main>` scrollTop exactly as router.tsx's
// router-level callback does, and add the slide type to our own transition.
// `vt-main` slides while the named identity groups morph independently on
// top. The fallback path skips the shell-slide coordination because there
// is no shell slide on Firefox.

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
    els.avatar.style.viewTransitionName = on ? IDENTITY_AVATAR_MORPH_ID : "";
  if (els.name) els.name.style.viewTransitionName = on ? IDENTITY_NAME_MORPH_ID : "";
}

// list↔detail subroute pairs (matches↔match-detail, champions↔champion-
// detail) aren't tab slides and shouldn't morph the identity. Replicates
// the rule from `navigation-type.ts`'s `isLolListDetailPair` so the rect-
// FLIP path doesn't depend on the VT-gated `getNavigationType`.
function isLolListDetailPair(from: string, to: string): boolean {
  if (!from.startsWith("/lol/") || !to.startsWith("/lol/")) return false;
  const fromSlug = from.slice("/lol/".length).split("/")[0];
  const toSlug = to.slice("/lol/".length).split("/")[0];
  if (!fromSlug || fromSlug !== toSlug) return false;
  for (const sub of ["matches", "champions"]) {
    const root = `/lol/${fromSlug}/${sub}`;
    const fromIn = from === root || from.startsWith(`${root}/`);
    const toIn = to === root || to.startsWith(`${root}/`);
    if (fromIn && toIn) return true;
  }
  return false;
}

export interface IdentityMorphNavOptions {
  // Resolved (slug-substituted) pathnames, e.g. `/lol/vyoh-euw/matches`.
  fromPathname: string;
  toPathname: string;
  // The destination is the Profile landing (idx 0), which scroll-resets to the
  // hero on arrival — so it always has a destination identity to morph into.
  toIsProfileIndex: boolean;
  // Pre-bound navigation to the target route, with `viewTransition: false` so
  // it doesn't nest a second router-level VT inside ours.
  navigate: () => Promise<unknown>;
}

/**
 * Run the Profile↔tab identity morph for a section-tab click. Returns `true`
 * when it took over navigation (the caller should `preventDefault()` the tab's
 * `<Link>`); `false` when the morph doesn't apply and the plain router slide
 * should handle the nav instead.
 */
export function runIdentityMorphNav(opts: IdentityMorphNavOptions): boolean {
  // Same-section gate + list↔detail exclusion. These checks duplicate the
  // classification in `navigation-type.ts` so the rect-FLIP fallback can
  // run on Firefox without depending on `getNavigationType` (which gates
  // itself on VT support and returns false on Firefox).
  if (!opts.toPathname.startsWith("/lol/") || !opts.fromPathname.startsWith("/lol/")) {
    return false;
  }
  if (isLolListDetailPair(opts.fromPathname, opts.toPathname)) return false;

  const source = readMarkedIdentity();
  if (!source.avatar && !source.name) return false;
  // The hero lives inside `<main>` (`[data-vt-main]`); the strip is portaled
  // into the fixed header outside it. A morph is only meaningful when a hero is
  // on one end: source-hero (Profile-at-scroll-top → tab) or destination-hero
  // (any tab → Profile). Strip→strip navs (tab→tab, or compact-Profile→tab)
  // leave the persistent header strip in place — nothing to morph.
  const sourceIsHero =
    !!source.avatar?.closest("[data-vt-main]") ||
    !!source.name?.closest("[data-vt-main]");
  if (!opts.toIsProfileIndex && !sourceIsHero) return false;

  // Capture source rects synchronously — used by the rect-FLIP fallback.
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
      // resolves). We must NOT wait on requestAnimationFrame here: rAF
      // callbacks don't run while the VT update callback's promise is
      // pending, so awaiting one deadlocks the whole transition and
      // freezes the page. `navigate()` resolves post-commit, so the
      // destination marker is already in the DOM; if a concurrent commit
      // lags it, the morph degrades to the slide's crossfade.
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
