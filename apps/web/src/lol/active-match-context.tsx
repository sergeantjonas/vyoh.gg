import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Ctx = {
  activeMatch: string | null;
  setActiveMatch: (id: string | null) => void;
  saveListScroll: () => void;
  readListScroll: () => number;
  morphEpoch: number;
  bumpMorphEpoch: () => void;
};

const ActiveMatchContext = createContext<Ctx | null>(null);

export function ActiveMatchProvider({ children }: { children: ReactNode }) {
  const [activeMatch, set] = useState<string | null>(null);
  const [morphEpoch, setMorphEpoch] = useState(0);
  const setActiveMatch = useCallback((id: string | null) => set(id), []);
  const bumpMorphEpoch = useCallback(() => setMorphEpoch((e) => e + 1), []);
  const scrollYRef = useRef(0);
  const saveListScroll = useCallback(() => {
    scrollYRef.current = window.scrollY;
  }, []);
  const readListScroll = useCallback(() => scrollYRef.current, []);
  const value = useMemo(
    () => ({
      activeMatch,
      setActiveMatch,
      saveListScroll,
      readListScroll,
      morphEpoch,
      bumpMorphEpoch,
    }),
    [
      activeMatch,
      setActiveMatch,
      saveListScroll,
      readListScroll,
      morphEpoch,
      bumpMorphEpoch,
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
