import { ChapterLabel } from "@/components/ui/chapter-label";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
// Baseline: personal — top duo by shared games from your own match history; WR is within the duo's games only.
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { useDuos } from "@/lol/profile/use-duos";
import { ChapterShell } from "@/lol/recap/chapter-shell";
import { formatPercent } from "@vyoh/shared";

const MIN_GAMES_FOR_DUO = 5;

export function RecapDuoOfYear({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data } = useDuos(account, 200);
  const championName = useChampionName();

  const top = data?.[0];
  const empty = !top || top.games < MIN_GAMES_FOR_DUO;

  if (empty) {
    return (
      <ChapterShell>
        <ChapterLabel>Duo of the year</ChapterLabel>
        <p className="text-base text-muted-foreground">
          Once you've queued five or more games with the same teammate, your duo will land
          here.
        </p>
      </ChapterShell>
    );
  }

  const wr = formatPercent(top.wins / top.games);
  const losses = top.games - top.wins;

  return (
    <ChapterShell populated>
      <ChapterLabel>Duo of the year</ChapterLabel>
      <div className="flex items-center gap-4">
        <ChampionSquareIcon
          championName={top.topChampion}
          alt={championName(top.topChampion)}
          className="size-14 shrink-0 rounded-lg ring-1 ring-border/60"
        />
        <div className="flex flex-col">
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            {top.gameName}
            <span className="ml-1 text-muted-foreground">#{top.tagLine}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {top.games} games · {wr} win rate · most on {championName(top.topChampion)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm tabular-nums">
        <span className="text-emerald-500/80">{top.wins}W</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-rose-500/80">{losses}L</span>
      </div>
    </ChapterShell>
  );
}
