import { SectionTitle } from "@/components/ui/section-title";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import { OWNER_TIME_ZONE, queueLabel } from "@vyoh/shared";
import { useAccountHistory } from "./use-account-history";

const GAMES = new Intl.NumberFormat("en-GB");
const SINCE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

// ThisPatchBadge's border and fill, without a backdrop filter: the section is
// not CV-gated, and a frosted chip would promote a layer on load.
const CHIP =
  "rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 text-xs tabular-nums text-muted-foreground";

export function ProfileHistoryChips({ accountSlug }: { accountSlug: string }) {
  const history = useAccountHistory(accountSlug).data;
  const championName = useChampionName();
  const first = history?.firstGame;
  if (!history || !first) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>History</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <span className={CHIP}>
          {GAMES.format(history.totalGames)} {history.totalGames === 1 ? "game" : "games"}{" "}
          tracked since {SINCE.format(new Date(first.playedAt))}
        </span>
        <Link
          to="/lol/$accountSlug/matches/$matchId"
          params={{ accountSlug, matchId: first.matchId }}
          className={`${CHIP} transition-colors hover:bg-foreground/10 hover:text-foreground`}
        >
          First game: {championName(first.champion)} · {queueLabel(first.queueId)} ·{" "}
          {first.win ? "win" : "loss"}
        </Link>
      </div>
    </div>
  );
}
