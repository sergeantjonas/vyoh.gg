import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeLifetimeTotals } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchHomeLifetimeTotals(): Promise<HomeLifetimeTotals> {
  const res = await fetch(`${API_URL}/home/lifetime-totals`);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<HomeLifetimeTotals>;
}

export function useHomeLifetimeTotals() {
  return useQuery({
    queryKey: ["home", "lifetime-totals"],
    queryFn: fetchHomeLifetimeTotals,
    // Alltime aggregates barely shift on a per-interaction basis; same
    // 30-min staleTime as the other home hooks.
    staleTime: 30 * 60 * 1_000,
  });
}
