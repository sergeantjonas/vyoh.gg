import { useState } from "react";

export function usePerfFlag(): boolean {
  const [enabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("perf");
  });
  return enabled;
}
