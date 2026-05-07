import { type ReactNode, createContext, useContext } from "react";

const HoverChampionContext = createContext<((c: string | null) => void) | null>(null);

export function useHoverChampion() {
  return useContext(HoverChampionContext);
}

export function HoverChampionProvider({
  children,
  setHovered,
}: {
  children: ReactNode;
  setHovered: (c: string | null) => void;
}) {
  return (
    <HoverChampionContext.Provider value={setHovered}>
      {children}
    </HoverChampionContext.Provider>
  );
}
