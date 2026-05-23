import { mainScrollRef } from "@/lib/scroll-container";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ChampionOrigin = {
  championAlias: string;
  rect: DOMRect;
  direction: "forward" | "backward";
};

type Ctx = {
  activeChampion: string | null;
  setActiveChampion: (alias: string | null) => void;
  saveListScroll: () => void;
  readListScroll: () => number;
  clearListScroll: () => void;
  originRectRef: { current: ChampionOrigin | null };
  setOriginRect: (r: ChampionOrigin | null) => void;
};

const ActiveChampionContext = createContext<Ctx | null>(null);

export function ActiveChampionProvider({ children }: { children: ReactNode }) {
  const [activeChampion, set] = useState<string | null>(null);
  const setActiveChampion = useCallback((alias: string | null) => set(alias), []);
  const scrollYRef = useRef(0);
  const saveListScroll = useCallback(() => {
    scrollYRef.current = mainScrollRef.current?.scrollTop ?? 0;
  }, []);
  const readListScroll = useCallback(() => scrollYRef.current, []);
  const clearListScroll = useCallback(() => {
    scrollYRef.current = 0;
  }, []);
  const originRectRef = useRef<ChampionOrigin | null>(null);
  const setOriginRect = useCallback((r: ChampionOrigin | null) => {
    originRectRef.current = r;
  }, []);
  const value = useMemo(
    () => ({
      activeChampion,
      setActiveChampion,
      saveListScroll,
      readListScroll,
      clearListScroll,
      originRectRef,
      setOriginRect,
    }),
    [
      activeChampion,
      setActiveChampion,
      saveListScroll,
      readListScroll,
      clearListScroll,
      setOriginRect,
    ]
  );
  return (
    <ActiveChampionContext.Provider value={value}>
      {children}
    </ActiveChampionContext.Provider>
  );
}

export function useActiveChampion(): Ctx {
  const ctx = useContext(ActiveChampionContext);
  if (!ctx)
    throw new Error("useActiveChampion must be used within ActiveChampionProvider");
  return ctx;
}
