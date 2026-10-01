import { useQuery } from "@tanstack/react-query";
import type { WebVitalsSummary } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";

async function fetchFieldVitals(): Promise<WebVitalsSummary> {
  const res = await fetch(`${API_URL}/rum/summary`);
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
  return res.json();
}

export function useFieldVitals() {
  return useQuery({
    queryKey: ["rum", "summary"],
    queryFn: fetchFieldVitals,
    // The api recomputes at most every five minutes, so asking sooner reads its
    // own copy back.
    staleTime: 5 * 60_000,
  });
}
