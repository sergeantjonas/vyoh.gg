import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { Chronotype, LolAccount } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchChronotype(account: LolAccount, count: number): Promise<Chronotype> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/chronotype`
  );
  url.searchParams.set("count", String(count));

  const res = await fetch(url);
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
  return res.json() as Promise<Chronotype>;
}

export function useChronotype(account: LolAccount | undefined, count = 500) {
  return useQuery({
    queryKey: [
      "lol",
      "chronotype",
      account?.region,
      account?.gameName,
      account?.tagLine,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchChronotype(account, count);
    },
    enabled: account !== undefined,
  });
}
