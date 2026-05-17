import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeChronotype } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchHomeChronotype(count: number): Promise<HomeChronotype> {
  const res = await fetch(`${API_URL}/home/chronotype?count=${count}`);
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
  return res.json() as Promise<HomeChronotype>;
}

export function useHomeChronotype(count = 500) {
  return useQuery({
    queryKey: ["home", "chronotype", count],
    queryFn: () => fetchHomeChronotype(count),
    staleTime: 30 * 60 * 1_000,
  });
}
