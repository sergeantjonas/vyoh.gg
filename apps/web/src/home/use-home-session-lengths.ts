import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeSessionLengths } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchHomeSessionLengths(): Promise<HomeSessionLengths> {
  const res = await fetch(`${API_URL}/home/session-lengths`);
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
  return res.json() as Promise<HomeSessionLengths>;
}

export function useHomeSessionLengths() {
  return useQuery({
    queryKey: ["home", "session-lengths"],
    queryFn: fetchHomeSessionLengths,
    staleTime: 30 * 60 * 1_000,
  });
}
