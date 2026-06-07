import { mainScrollRef } from "@/lib/scroll-container";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

// Active scroll container for the current React subtree. Components like
// useScrollspy and the champion sticky strip read this when they need to
// observe scroll on the *enclosing* scrollable region — which is <main> by
// default, but switches to a detail panel's internal scroll container while
// the panel is mounted (because the panel locks main scroll, so anything that
// used to scroll the page now needs to scroll the panel instead).
//
// Provider is supplied by SlidePanel; reading code falls back to mainScrollRef
// when no provider is present (every non-panel surface).
type ScrollContainerCtx = {
  el: HTMLElement | null;
};

const ScrollContainerContext = createContext<ScrollContainerCtx | null>(null);

export function ScrollContainerProvider({
  el,
  children,
}: {
  el: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <ScrollContainerContext.Provider value={{ el }}>
      {children}
    </ScrollContainerContext.Provider>
  );
}

export function useActiveScrollContainer(): HTMLElement | null {
  const ctx = useContext(ScrollContainerContext);
  return ctx?.el ?? mainScrollRef.current;
}

// Lightweight pubsub for "is any detail panel currently open." Components
// that overlay <main> (ScrollToTop, future floating affordances) read this
// to hide themselves while a panel is open — they target main scroll which
// is locked, and they'd render through the panel since they typically sit
// at a higher z-index. SlidePanel publishes; consumers subscribe.
let openPanelCount = 0;
const listeners = new Set<(open: boolean) => void>();

function notify() {
  const open = openPanelCount > 0;
  for (const fn of listeners) fn(open);
}

export function registerOpenDetailPanel(): () => void {
  openPanelCount += 1;
  notify();
  return () => {
    openPanelCount -= 1;
    notify();
  };
}

export function useDetailPanelOpen(): boolean {
  const [open, setOpen] = useState(openPanelCount > 0);
  useEffect(() => {
    listeners.add(setOpen);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);
  return open;
}
