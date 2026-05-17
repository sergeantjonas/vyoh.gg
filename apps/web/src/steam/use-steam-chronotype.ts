import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamChronotype } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchSteamChronotype(count: number): Promise<SteamChronotype> {
  const res = await fetch(`${API_URL}/steam/chronotype?count=${count}`);
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
  return res.json() as Promise<SteamChronotype>;
}

export function useSteamChronotype(count = 500) {
  return useQuery({
    queryKey: ["steam", "chronotype", count],
    queryFn: () => fetchSteamChronotype(count),
    staleTime: 30 * 60 * 1_000,
  });
}
