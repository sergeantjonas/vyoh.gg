import { createContext, useContext } from "react";

type SectionShellState = { compact: boolean };

const SectionShellContext = createContext<SectionShellState | null>(null);

export const SectionShellProvider = SectionShellContext.Provider;

// Identity / actions / nav slots inside <SectionShell> read `compact` via this
// hook so they can shrink avatars, fade out region/level badges, etc. without
// the shell having to render-prop every slot.
export function useSectionShellState(): SectionShellState {
  const ctx = useContext(SectionShellContext);
  if (!ctx) {
    throw new Error("useSectionShellState must be used inside a <SectionShell>");
  }
  return ctx;
}
