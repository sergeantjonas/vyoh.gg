import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeToday } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchHomeToday(): Promise<HomeToday> {
  const res = await fetch(`${API_URL}/home/today`);
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
  return res.json() as Promise<HomeToday>;
}

export function useHomeToday() {
  return useQuery({
    queryKey: ["home", "today"],
    queryFn: fetchHomeToday,
    // 24h aggregates shift on every match write and every Steam poll; a
    // 5-minute staleTime keeps the chip live without hammering the API
    // on every revisit. Same cadence as the favicon-dot's live-game
    // pollers — fits the "pulse, not real-time" register.
    staleTime: 5 * 60 * 1_000,
    refetchInterval: 5 * 60 * 1_000,
  });
}
