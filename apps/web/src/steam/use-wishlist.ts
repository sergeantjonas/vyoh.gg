import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamWishlist } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchWishlist(): Promise<SteamWishlist> {
  const res = await fetch(`${API_URL}/steam/wishlist`);
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
  return res.json() as Promise<SteamWishlist>;
}

export function useSteamWishlist() {
  return useQuery({
    queryKey: ["steam", "wishlist"],
    queryFn: fetchWishlist,
    // The backend already caches GetWishlist + GetItems behind 1h / 24h TTLs;
    // the frontend just rides that. No need for an aggressive refetch.
    staleTime: 5 * 60 * 1_000,
  });
}
