import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { CalibrationStats, LolAccount } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchPregameCalibration(
  account: LolAccount,
  queueIds: readonly number[]
): Promise<CalibrationStats> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/pregame-calibration`
  );
  if (queueIds.length > 0) {
    url.searchParams.set("queueIds", queueIds.join(","));
  }

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
  return res.json() as Promise<CalibrationStats>;
}

export function usePregameCalibration(
  account: LolAccount | undefined,
  queueIds: readonly number[]
) {
  const sortedIds = [...queueIds].sort((a, b) => a - b);
  return useQuery({
    queryKey: [
      "lol",
      "pregame-calibration",
      account?.region,
      account?.gameName,
      account?.tagLine,
      sortedIds.join(","),
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchPregameCalibration(account, sortedIds);
    },
    enabled: account !== undefined,
  });
}
