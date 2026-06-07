import { mainScrollRef } from "@/lib/scroll-container";
import { type ReactNode, createContext, useContext } from "react";

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
