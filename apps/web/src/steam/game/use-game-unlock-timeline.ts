import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { GameUnlockTimeline } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchGameUnlockTimeline(appid: number): Promise<GameUnlockTimeline> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/unlock-timeline`);
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
  return res.json() as Promise<GameUnlockTimeline>;
}

export function useGameUnlockTimeline(appid: number) {
  return useQuery({
    queryKey: ["steam", "game", appid, "unlock-timeline"],
    queryFn: () => fetchGameUnlockTimeline(appid),
    staleTime: 30 * 60 * 1_000,
  });
}
