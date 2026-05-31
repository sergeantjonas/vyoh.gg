import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeActivityIntensity } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchHomeActivityIntensity(): Promise<HomeActivityIntensity> {
  const res = await fetch(`${API_URL}/home/activity-intensity`);
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
  return res.json() as Promise<HomeActivityIntensity>;
}

export function useHomeActivityIntensity() {
  return useQuery({
    queryKey: ["home", "activity-intensity"],
    queryFn: fetchHomeActivityIntensity,
    // Intensity is reactive to ongoing play; refresh every 5 min so a session
    // that starts after the page loads still shifts the hero within the hour.
    staleTime: 5 * 60 * 1_000,
  });
}
