import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useMatchDetail } from "@/lol/matches/use-match-detail";
import type { MatchDetail } from "@vyoh/shared";

// Tab routes share the same data needs (detail, the owner's participant slot)
// as the layout. The layout already gates render on detail.data, so by the
// time a tab mounts the query is in cache — calling `useMatchDetail` again
// here is free thanks to TanStack Query's dedup.
export function useMatchTabProps(
  accountSlug: string,
  matchId: string
): { detail: MatchDetail; myPuuid: string | undefined } | null {
  const detail = useMatchDetail(matchId);
  const account = useAccountFromSlug(accountSlug);
  if (!detail.data) return null;
  const myParticipant = account
    ? detail.data.participants.find(
        (p) =>
          p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
          p.riotIdTagline.toLowerCase() === account.tagLine.toLowerCase()
      )
    : undefined;
  return { detail: detail.data, myPuuid: myParticipant?.puuid };
}
