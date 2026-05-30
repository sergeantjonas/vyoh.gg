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
// The repo's proven nav-morph idiom is imperative (match-row, champion-table,
// library-row): name the source `view-transition-name` synchronously so it's
// present at OLD-snapshot capture, hand-roll a single `startViewTransition`,
// clear the source and navigate inside it, then let the destination carry the
// matching name at NEW-snapshot time. Those surfaces name the destination
// declaratively because list and detail are different routes — but our header
// strip is *persistent* across tabs, so a permanent name would attach on every
// slide (matches → trends) and pull the strip out of the shell snapshot for
// navs that shouldn't morph it. Instead we name both ends imperatively from the
// single `[data-identity-{avatar,name}]` marker (identity-hero.tsx /
// $accountSlug.tsx guarantee exactly one of each in the DOM) and clear
// everything when the transition finishes.
//
// Unlike list↔detail (which opts out of router VT entirely), this morph runs
// *alongside* the section slide: we set `data-vt-shell="on"` + reset
// `<main>` scrollTop exactly as main.tsx's router-level callback does, and add
// the slide type to our own transition. `vt-main` slides while the named
// identity groups morph independently on top.

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

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
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
  if (!supportsViewTransitions()) return false;
  const doc = document as DocumentWithVT;
  const start = doc.startViewTransition;
  if (!start) return false;

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
  // Only sibling tab slides morph the identity; anything else (cross-section,
  // account-swap, list↔detail) is left to its own handler.
  if (!slideType) return false;

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

  setIdentityNames(source, true);
  // Drive the section slide ourselves (router VT is opted out on this nav).
  document.body.dataset.vtShell = "on";
  if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;

  const transition = start.call(doc, async () => {
    // Clear the source name before the destination mounts so the NEW snapshot
    // never sees two elements sharing one name (the about-to-unmount source and
    // the destination).
    setIdentityNames(source, false);
    await opts.navigate();
    // Route committed; wait one frame for layout, then name the freshly mounted
    // destination identity so it's present at NEW-snapshot capture.
    await nextFrame();
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
