import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, ObjectiveFirsts } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchObjectiveFirsts(
  account: LolAccount,
  count: number
): Promise<ObjectiveFirsts> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/objective-firsts`
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
  return res.json() as Promise<ObjectiveFirsts>;
}

export function useObjectiveFirsts(account: LolAccount | undefined, count = 200) {
  return useQuery({
    queryKey: [
      "lol",
      "objective-firsts",
      account?.region,
      account?.gameName,
      account?.tagLine,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchObjectiveFirsts(account, count);
    },
    enabled: account !== undefined,
  });
}
