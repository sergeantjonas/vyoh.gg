import { useCallback, useSyncExternalStore } from "react";

// Owner preference for whether mature-bucket screenshots are merged into the
// rendered set on game-detail surfaces. Defaults to off — Steam's storefront
// default — but the toggle is always available when a game's enrichment row
// actually carries mature entries (see GameScreenshotStrip). The preference
// is a single global flag, persisted in localStorage so a single click on
// any game-detail surface sticks across reloads and across other games.
//
// `useSyncExternalStore` keeps every mounted consumer in sync — toggling on
// the game-detail strip immediately reflects in any other open hovercard,
// without prop-drilling or context. Storage event listener catches changes
// from other browser tabs.

const STORAGE_KEY = "vyoh:steam-show-mature-screenshots";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage can throw in privacy / sandbox contexts — fall back to off.
    return false;
  }
}

function writeStored(next: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — toggle still flips in-memory for this session
    // via the subscriber notification below.
  }
}

// In-memory subscriber set so a setShowMature() in one component notifies
// every other mounted consumer in the same tab. The storage event only fires
// across tabs, not within the same one.
const subscribers = new Set<() => void>();
function notify() {
  for (const cb of subscribers) cb();
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMatureScreenshotsPref(): {
  showMature: boolean;
  setShowMature: (next: boolean) => void;
} {
  const showMature = useSyncExternalStore(
    subscribe,
    readStored,
    () => false // SSR snapshot — irrelevant in this Vite SPA but required by the API
  );
  const setShowMature = useCallback((next: boolean) => {
    writeStored(next);
    notify();
  }, []);
  return { showMature, setShowMature };
}
