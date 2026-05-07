import { useRouterState } from "@tanstack/react-router";

export function usePerfFlag(): boolean {
  return useRouterState({
    select: (s) => "perf" in (s.location.search as Record<string, unknown>),
  });
}
