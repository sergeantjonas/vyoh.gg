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

export type GameOrigin = {
  appid: number;
  // Hero wrapper rect on the detail page. Always present — the detail
  // hero box renders even when its img fails, so the rect is valid even
  // for assets-missing games.
  heroRect: DOMRect;
  // Logo img rect on the detail page. Null when the detail page fell
  // back to the text-only `<h2>` (logoFailed branch) — the row's logo
  // then simply crossfades via the default route transition.
  logoRect: DOMRect | null;
  direction: "forward" | "backward";
};

type Ctx = {
  activeGame: number | null;
  setActiveGame: (appid: number | null) => void;
  saveListScroll: () => void;
  readListScroll: () => number;
  clearListScroll: () => void;
  originRectRef: { current: GameOrigin | null };
  setOriginRect: (r: GameOrigin | null) => void;
};

const ActiveGameContext = createContext<Ctx | null>(null);

export function ActiveGameProvider({ children }: { children: ReactNode }) {
  const [activeGame, set] = useState<number | null>(null);
  const setActiveGame = useCallback((appid: number | null) => set(appid), []);
  const scrollYRef = useRef(0);
  const saveListScroll = useCallback(() => {
    scrollYRef.current = mainScrollRef.current?.scrollTop ?? 0;
  }, []);
  const readListScroll = useCallback(() => scrollYRef.current, []);
  const clearListScroll = useCallback(() => {
    scrollYRef.current = 0;
  }, []);
  const originRectRef = useRef<GameOrigin | null>(null);
  const setOriginRect = useCallback((r: GameOrigin | null) => {
    originRectRef.current = r;
  }, []);
  const value = useMemo(
    () => ({
      activeGame,
      setActiveGame,
      saveListScroll,
      readListScroll,
      clearListScroll,
      originRectRef,
      setOriginRect,
    }),
    [
      activeGame,
      setActiveGame,
      saveListScroll,
      readListScroll,
      clearListScroll,
      setOriginRect,
    ]
  );
  return (
    <ActiveGameContext.Provider value={value}>{children}</ActiveGameContext.Provider>
  );
}

export function useActiveGame(): Ctx {
  const ctx = useContext(ActiveGameContext);
  if (!ctx) throw new Error("useActiveGame must be used within ActiveGameProvider");
  return ctx;
}
