import { createContext, useContext } from "react";

type SectionShellState = {
  compact: boolean;
  // Viewport-px the section header is expected to end at, used by anything
  // that docks under it before the measured `--account-header-h` exists.
  headerDockPx?: number | undefined;
};

const SectionShellContext = createContext<SectionShellState | null>(null);

export const SectionShellProvider = SectionShellContext.Provider;

// Tolerates a missing shell: a panel rendered outside any section (tests,
// a future sectionless route) simply has no dock fallback.
export function useHeaderDockPx(): number | undefined {
  return useContext(SectionShellContext)?.headerDockPx;
}

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
