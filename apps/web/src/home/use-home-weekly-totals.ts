import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeWeeklyTotals } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchHomeWeeklyTotals(): Promise<HomeWeeklyTotals> {
  const res = await fetch(`${API_URL}/home/weekly-totals`);
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
  return res.json() as Promise<HomeWeeklyTotals>;
}

export function useHomeWeeklyTotals() {
  return useQuery({
    queryKey: ["home", "weekly-totals"],
    queryFn: fetchHomeWeeklyTotals,
    staleTime: 30 * 60 * 1_000,
  });
}
