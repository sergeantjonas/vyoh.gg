import { useState } from "react";

const STORAGE_KEY = "vyoh:perf";

export function usePerfFlag(): boolean {
  const [enabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const fromUrl = new URLSearchParams(window.location.search).has("perf");
    if (fromUrl) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  return enabled;
}
