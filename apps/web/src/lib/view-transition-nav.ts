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
