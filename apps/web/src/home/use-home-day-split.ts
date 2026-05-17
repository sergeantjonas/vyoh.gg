import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { HomeDaySplit } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchHomeDaySplit(): Promise<HomeDaySplit> {
  const res = await fetch(`${API_URL}/home/day-split`);
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
  return res.json() as Promise<HomeDaySplit>;
}

export function useHomeDaySplit() {
  return useQuery({
    queryKey: ["home", "day-split"],
    queryFn: fetchHomeDaySplit,
    staleTime: 30 * 60 * 1_000,
  });
}
