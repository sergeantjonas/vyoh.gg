import { computeLpDeltaMap } from "@vyoh/shared";
import { useMemo } from "react";
import { useMatchWindow } from "./match-window-context";

export function useLpDeltaMap(): Map<string, number> {
  const { matches } = useMatchWindow();
  return useMemo(() => computeLpDeltaMap(matches ?? []), [matches]);
}
