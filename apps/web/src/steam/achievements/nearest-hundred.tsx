import { SectionTitle } from "@/components/ui/section-title";
import {
  type NearestEntry,
  joinNearestEntries,
  privateGamesSentence,
} from "@/steam/_shared/nearest-entries";
import { formatRarityPercentEditorial } from "@/steam/_shared/rarity-percent";
import { useCompletionCandidates } from "@/steam/use-completion-candidates";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { Link } from "@tanstack/react-router";
import type { SteamCompletionCandidate } from "@vyoh/shared";
import { useMemo } from "react";

// The average and the blocker come from the locked achievements that have
// been polled, so the caption speaks about "them" rather than the full count.
// One rated achievement (or a flat spread) has no separate blocker to name.
function rarityCaption(entry: SteamCompletionCandidate): string {
  if (entry.remainingAvgPercent === null) return "rarity not polled yet";
  const avg = formatRarityPercentEditorial(entry.remainingAvgPercent);
  if (
    entry.remainingMinPercent === null ||
    entry.remainingMinPercent === entry.remainingAvgPercent
  ) {
    return `${avg} of players have them`;
  }
  return `${avg} avg · rarest ${formatRarityPercentEditorial(entry.remainingMinPercent)}`;
}

export function NearestHundred() {
  const candidates = useCompletionCandidates();
  const owned = useSteamOwnedGames();

  const entries = useMemo<NearestEntry[]>(() => {
    if (!candidates.data || !owned.data) return [];
    return joinNearestEntries(candidates.data.candidates, owned.data.games);
  }, [candidates.data, owned.data]);

  if (candidates.isPending || owned.isPending) return null;
  if (candidates.isError || owned.isError) return null;
  // Nothing started-but-unfinished is a real state (fresh library, or every
  // touched game already in the hall); collapse rather than announce it. That
  // includes the case where the only started games are private on Steam —
  // the per-game panel carries that message, the ranking has nothing to rank.
  if (entries.length === 0) return null;

  const privateGames = privateGamesSentence(
    candidates.data.privateAppids,
    owned.data.games
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <SectionTitle as="h2">
          Nearest 100%
          <span className="ml-2 font-normal tabular-nums text-muted-foreground/60">
            {candidates.data.candidates.length}
          </span>
        </SectionTitle>
        <p className="text-xs text-muted-foreground/70">Least work left to finish</p>
      </div>
      <ol className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <NearestRow key={e.appid} entry={e} rank={i + 1} />
        ))}
      </ol>
      {privateGames !== null && (
        <p className="text-xs text-muted-foreground/70">
          Not ranked: {privateGames}. Steam keeps their achievement stats private, so what
          is left is unknowable.
        </p>
      )}
    </section>
  );
}

function NearestRow({ entry, rank }: { entry: NearestEntry; rank: number }) {
  const progress = entry.unlocked / entry.total;
  const rarity = rarityCaption(entry);

  return (
    <li>
      <Link
        to="/steam/library/$appid"
        params={{ appid: String(entry.appid) }}
        className="group/row flex items-center gap-4 rounded-lg border border-border/40 bg-card/60 p-3 backdrop-blur-sm transition-colors hover:border-border hover:bg-card/80"
      >
        <span
          aria-hidden
          className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground/60"
        >
          {rank}
        </span>
        <img
          src={entry.capsuleUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={92}
          height={35}
          className="h-[35px] w-[92px] shrink-0 rounded-sm object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium text-foreground/90 underline-offset-2 group-hover/row:underline">
              {entry.name}
            </p>
            <p className="shrink-0 text-sm tabular-nums">
              <span className="font-semibold">{entry.remaining}</span>
              <span className="text-muted-foreground/70"> of {entry.total} left</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40"
            >
              <div
                className="h-full rounded-full bg-foreground/60 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {rarity}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
