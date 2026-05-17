import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeFirstPlayed } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchHomeFirstPlayed(): Promise<HomeFirstPlayed> {
  const res = await fetch(`${API_URL}/home/first-played`);
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
  return res.json() as Promise<HomeFirstPlayed>;
}

export function useHomeFirstPlayed() {
  return useQuery({
    queryKey: ["home", "first-played"],
    queryFn: fetchHomeFirstPlayed,
    staleTime: 30 * 60 * 1_000,
  });
}
