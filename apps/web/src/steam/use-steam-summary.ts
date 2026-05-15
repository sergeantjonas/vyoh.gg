import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamSummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchSteamSummary(): Promise<SteamSummary> {
  const res = await fetch(`${API_URL}/steam/summary`);
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
  return res.json() as Promise<SteamSummary>;
}

export function useSteamSummary() {
  return useQuery({
    queryKey: ["steam", "summary"],
    queryFn: fetchSteamSummary,
    staleTime: 5 * 60 * 1_000,
  });
}
