import { type ReactNode, createContext, useContext, useState } from "react";

/**
 * The DOM element that pages can portal their per-view controls into. Lives
 * at the account-layout level (sibling of the page-slide `m.div`, not inside
 * it) so it sits in stable, transform-free space — sticky positioning is
 * unreliable inside the slide-transition wrapper.
 */
const AccountControlsSlotContext = createContext<HTMLDivElement | null>(null);

export function AccountControlsSlotProvider({
  value,
  children,
}: {
  value: HTMLDivElement | null;
  children: ReactNode;
}) {
  return (
    <AccountControlsSlotContext.Provider value={value}>
      {children}
    </AccountControlsSlotContext.Provider>
  );
}

/** Returns the layout-level controls slot DOM node, or null before mount. */
export function useAccountControlsSlot(): HTMLDivElement | null {
  return useContext(AccountControlsSlotContext);
}

/**
 * Hook for layout to manage the slot ref. Returns a ref-callback to attach to
 * the slot div, and the current element (so the Provider can publish it).
 */
export function useAccountControlsSlotState() {
  return useState<HTMLDivElement | null>(null);
}
