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

export type CardOrigin = { matchId: string; rect: DOMRect };

type Ctx = {
  activeMatch: string | null;
  setActiveMatch: (id: string | null) => void;
  saveListScroll: () => void;
  readListScroll: () => number;
  clearListScroll: () => void;
  originRectRef: { current: CardOrigin | null };
  setOriginRect: (r: CardOrigin | null) => void;
};

const ActiveMatchContext = createContext<Ctx | null>(null);

export function ActiveMatchProvider({ children }: { children: ReactNode }) {
  const [activeMatch, set] = useState<string | null>(null);
  const setActiveMatch = useCallback((id: string | null) => set(id), []);
  const scrollYRef = useRef(0);
  const saveListScroll = useCallback(() => {
    scrollYRef.current = mainScrollRef.current?.scrollTop ?? 0;
  }, []);
  const readListScroll = useCallback(() => scrollYRef.current, []);
  const clearListScroll = useCallback(() => {
    scrollYRef.current = 0;
  }, []);
  const originRectRef = useRef<CardOrigin | null>(null);
  const setOriginRect = useCallback((r: CardOrigin | null) => {
    originRectRef.current = r;
  }, []);
  const value = useMemo(
    () => ({
      activeMatch,
      setActiveMatch,
      saveListScroll,
      readListScroll,
      clearListScroll,
      originRectRef,
      setOriginRect,
    }),
    [
      activeMatch,
      setActiveMatch,
      saveListScroll,
      readListScroll,
      clearListScroll,
      setOriginRect,
    ]
  );
  return (
    <ActiveMatchContext.Provider value={value}>{children}</ActiveMatchContext.Provider>
  );
}

export function useActiveMatch(): Ctx {
  const ctx = useContext(ActiveMatchContext);
  if (!ctx) throw new Error("useActiveMatch must be used within ActiveMatchProvider");
  return ctx;
}
