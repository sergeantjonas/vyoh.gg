import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Ctx = {
  activeMatch: string | null;
  setActiveMatch: (id: string | null) => void;
};

const ActiveMatchContext = createContext<Ctx | null>(null);

export function ActiveMatchProvider({ children }: { children: ReactNode }) {
  const [activeMatch, set] = useState<string | null>(null);
  const setActiveMatch = useCallback((id: string | null) => set(id), []);
  const value = useMemo(
    () => ({ activeMatch, setActiveMatch }),
    [activeMatch, setActiveMatch]
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
