import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

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
  const startVT = doc.startViewTransition;
  if (!startVT) {
    await navigateFn();
    return;
  }
  startVT(async () => {
    await navigateFn();
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
