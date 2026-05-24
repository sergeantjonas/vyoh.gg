import { isWebKit } from "@/lib/is-webkit";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { flushSync } from "react-dom";

/**
 * View Transitions API integration for TanStack Router navigations.
 *
 * `view-transition-name` naming convention (do not break — collisions cause
 * the browser to drop one of the morph pairs silently):
 *   <surface>-<id>[-<slot>]
 * Examples:
 *   champion-${alias}
 *   match-${matchId}-icon
 *   match-${matchId}-kda
 *   steam-game-${appId}
 *
 * Reduced-motion is handled in styles/view-transitions.css (the CSS guard
 * keeps the snapshot/swap atomic while killing the animation), so we do not
 * branch on prefers-reduced-motion here.
 */

type StartViewTransitionFn = (callback: () => void | Promise<void>) => unknown;

type DocumentWithVT = Document & {
  startViewTransition?: StartViewTransitionFn;
};

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

/**
 * Dev-only lifecycle logger. Patches `document.startViewTransition` once so
 * every call (ours, TanStack Router's internal one, any future call site)
 * logs its lifecycle promise resolutions to the console. Hangs are visible
 * as "started but never finished" entries; the rect-morph fallback is
 * unaffected because it never invokes this API.
 *
 * Removed in production builds via the `import.meta.env.DEV` guard.
 *
 * Opt-in via `localStorage.setItem('vt-debug', '1')`. NOT auto-installed
 * because globally patching `document.startViewTransition` shifts module-
 * load and effect-timing in dev enough to disrupt downstream code that
 * depends on stable frame ordering — the match-list scroll-restore pin
 * loop is one such consumer (its 600 ms RAF window lined up cleanly
 * before the logger was auto-installed, regressed once we patched).
 * Prod builds were unaffected (the whole branch was stripped) but the
 * dev regression was real and confusing. Keep this off by default; enable
 * it deliberately when diagnosing a VT issue, then disable it again.
 */
function installViewTransitionLifecycleLogger(): void {
  if (typeof document === "undefined") return;
  const doc = document as DocumentWithVT & {
    __vtLoggerInstalled?: boolean;
  };
  if (doc.__vtLoggerInstalled) return;
  const native = doc.startViewTransition;
  if (!native) return;
  let nextId = 1;
  const wrapped = (callback: () => void | Promise<void>) => {
    const id = nextId++;
    const label = `[vt #${id}]`;
    console.info(`${label} startViewTransition called`);
    const transition = native.call(doc, callback) as unknown as {
      updateCallbackDone?: Promise<unknown>;
      ready?: Promise<unknown>;
      finished?: Promise<unknown>;
    };
    transition.updateCallbackDone?.then(
      () => console.info(`${label} updateCallbackDone resolved`),
      (err) => console.warn(`${label} updateCallbackDone rejected:`, err)
    );
    transition.ready?.then(
      () => console.info(`${label} ready (snapshots captured)`),
      (err) => {
        console.warn(`${label} ready rejected:`, err);
        // Walk the DOM and report every element with a view-transition-name —
        // a name-collision rejection means two share one and we need to know
        // which two. Cheap and only fires on failure.
        const offenders: Array<{ el: Element; name: string }> = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const name = window.getComputedStyle(el).viewTransitionName;
          if (name && name !== "none") offenders.push({ el, name });
        }
        if (offenders.length > 0) {
          console.group(
            `${label} elements with view-transition-name (${offenders.length}):`
          );
          for (const { el, name } of offenders) console.log(name, el);
          console.groupEnd();
        }
      }
    );
    transition.finished?.then(
      () => console.info(`${label} finished (transition complete)`),
      (err) => console.warn(`${label} finished rejected:`, err)
    );
    return transition;
  };
  // Cast through unknown — the DOM lib types `startViewTransition` as
  // non-optional with a strict ViewTransition return; our logger returns
  // a structural subset which is fine in practice.
  doc.startViewTransition = wrapped as unknown as typeof native;
  doc.__vtLoggerInstalled = true;
  console.info("[vt] lifecycle logger installed");
}

if (import.meta.env.DEV) {
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage?.getItem("vt-debug") === "1"
    ) {
      installViewTransitionLifecycleLogger();
    }
  } catch {
    // Privacy-mode browsers throw on localStorage access — silently skip.
  }
}

/**
 * Run a navigation inside `document.startViewTransition` when supported,
 * else call `navigateFn` directly.
 *
 * The navigation is awaited inside the VT callback so the snapshot stays
 * frozen until the new route's loaders have settled — otherwise the morph
 * captures a skeleton.
 */
export async function navigateWithViewTransition(
  navigateFn: () => void | Promise<void>
): Promise<void> {
  if (!supportsViewTransitions()) {
    await navigateFn();
    return;
  }
  const doc = document as DocumentWithVT;
  if (!doc.startViewTransition) {
    await navigateFn();
    return;
  }
  // Call via `doc.startViewTransition(...)` — Firefox enforces strict
  // receiver binding on DOM methods and throws TypeError on a destructured
  // reference. Chrome is lenient and masks the bug.
  doc.startViewTransition(async () => {
    await navigateFn();
  });
}

/**
 * Wrap a same-route state mutation (sort / filter change) in a View
 * Transition so items reorder via OLD→NEW position morphs instead of
 * snapping. The list rows/tiles carry `view-transition-name: <surface>-${id}`
 * on a stable wrapper so the browser pairs them automatically.
 *
 * Tagged with `intra-section` so per-element groups inherit the 320 ms iOS-
 * spring curve + `mix-blend-mode: normal` from view-transitions.css (the
 * latter matters here: many morphs overlap in z as rows fly past one
 * another, and the UA default blend reads as haze on overlap).
 *
 * Gated on WebKit. The Steam page's snapshot cost is what already drove the
 * Steam tab-nav VT bypass on Safari (every tile is an isolate stacking
 * context, achievements is a virtualised feed with shadowed cards, etc. —
 * see safari-vt-snapshot-cost.md). A whole-document snapshot pair on
 * sort/filter pays the same cost, so we snap on WebKit and morph elsewhere.
 */
export function withReorderViewTransition(update: () => void): void {
  if (!supportsViewTransitions() || isWebKit()) {
    update();
    return;
  }
  const doc = document as DocumentWithVT;
  if (!doc.startViewTransition) {
    update();
    return;
  }
  // Defer to the next microtask. When this helper wraps a Radix
  // Select/Popover `onValueChange`, we enter while the originating click is
  // still dispatching events from the portaled item — synchronously
  // committing parent state via flushSync at that point leaves Radix's
  // dismissable-layer half-finalised and the dropdown becomes unresponsive
  // on subsequent opens. One microtask lets Radix finish closing first;
  // the snapshot then captures a clean DOM with no open portal contents.
  queueMicrotask(() => {
    // Call via `doc.startViewTransition(...)` — Firefox enforces strict
    // receiver binding on DOM methods and throws TypeError on a destructured
    // reference (`const fn = doc.startViewTransition; fn(...)`). Chrome is
    // lenient and lets the bare call through, masking the bug.
    const transition = doc.startViewTransition?.(() => {
      // flushSync forces React to commit the state change synchronously
      // inside the VT callback so the NEW snapshot capture (right after
      // the callback returns) sees the post-sort DOM. Without it, React's
      // scheduler can commit after the snapshot and the morph captures
      // the OLD layout twice — visually a no-op.
      flushSync(update);
    }) as { types?: Set<string> } | undefined;
    // Post-creation mutation of `types` is supported wherever the
    // object-form of startViewTransition is (Chrome 125+, Safari 18.2+);
    // on older engines the Set is absent and we fall through to UA
    // defaults, which is acceptable.
    transition?.types?.add("intra-section");
  });
}

/**
 * Drop-in for TanStack Router's `useNavigate()` that wraps the navigation in
 * a view transition when supported.
 */
export function useViewTransitionNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (opts: Parameters<typeof navigate>[0]) =>
      navigateWithViewTransition(() => navigate(opts)),
    [navigate]
  );
}
