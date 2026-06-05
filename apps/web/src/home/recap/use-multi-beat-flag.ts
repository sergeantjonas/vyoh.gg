import { useSyncExternalStore } from "react";

/**
 * Reads `?layout=multi-beat` from the URL and returns whether the new
 * multi-beat chapter architecture should be used.
 *
 * Temporary flag for chunk-2 of the [multi-beat-chapter-arc](../../../docs/working-notes/cross-cutting/multi-beat-chapter-arc.md):
 * lets the owner toggle the new architecture per session by appending
 * `?layout=multi-beat` to the URL, without a build flag or restart.
 * When the new architecture lands as default (chunk 4), this hook + its
 * call site delete in one commit.
 *
 * Subscribes to `popstate` so browser back/forward updates the flag.
 * TanStack Router programmatic navigations don't fire popstate, but the
 * intended UX is "owner pastes URL, loads page" — full reload reads the
 * current `?layout=` value on mount.
 */
export function useMultiBeatFlag(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getSnapshot(): boolean {
  return new URLSearchParams(window.location.search).get("layout") === "multi-beat";
}

function getServerSnapshot(): boolean {
  return false;
}
