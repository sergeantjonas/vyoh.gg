import type { MatchSummary } from "@vyoh/shared";
import { type ReactNode, createContext, useContext } from "react";

type MatchWindowValue = {
  matches: MatchSummary[] | undefined;
  isPending: boolean;
  total: number;
  count: number;
  setCount: (next: number) => void;
};

const MatchWindowContext = createContext<MatchWindowValue | null>(null);

export function MatchWindowProvider({
  value,
  children,
}: {
  value: MatchWindowValue;
  children: ReactNode;
}) {
  return (
    <MatchWindowContext.Provider value={value}>{children}</MatchWindowContext.Provider>
  );
}

export function useMatchWindow(): MatchWindowValue {
  const ctx = useContext(MatchWindowContext);
  if (!ctx) {
    throw new Error("useMatchWindow must be used within a MatchWindowProvider");
  }
  return ctx;
}
