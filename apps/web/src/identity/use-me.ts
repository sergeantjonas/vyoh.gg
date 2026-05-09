import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMe(): Promise<Me> {
  const res = await fetch(`${API_URL}/me`);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 30_000,
  });
}
