import { CardShell } from "@/components/card-shell";
import { useLibraryCompletion } from "@/steam/use-library-completion";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { useSteamTags } from "@/steam/use-tags";
import type { SteamGameCompletion, SteamOwnedGame } from "@vyoh/shared";
import { useMemo } from "react";

// Floors. The "engaged with achievements" cohort needs enough games for a
// median to mean anything — five is the lowest count where the middle row
// stops swinging on a single new unlock. The tag-slice floor is tighter
// (three games per tag) because a slice that only shows up because of one
// outlier game isn't a pattern worth surfacing.
const MIN_SAMPLE = 5;
const MIN_TAG_SAMPLE = 3;
// A tag slice has to beat the library median by this many points before it
// reads as a real signal rather than rounding noise.
const TAG_SLICE_LEAD_POINTS = 15;

interface AxisVerdict {
  verdict: string;
  evidence: string;
  empty: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function bandFor(pct: number): string {
  if (pct >= 90) return "Hard completionist";
  if (pct >= 60) return "Sees it through";
  if (pct >= 30) return "Honest middle ground";
  if (pct >= 10) return "Skim, then move on";
  return "Pulls a few, drops it";
}

function buildVerdict(
  cohort: SteamGameCompletion[],
  tagSlice: { name: string; median: number; size: number } | null,
  libraryMedian: number
): AxisVerdict {
  const cohortSize = cohort.length;
  const headline = bandFor(libraryMedian);
  const baseEvidence = `${Math.round(libraryMedian)}% median across ${cohortSize} game${cohortSize === 1 ? "" : "s"} you've made progress in.`;
  if (tagSlice && tagSlice.median - libraryMedian >= TAG_SLICE_LEAD_POINTS) {
    return {
      verdict: `${headline} — except ${tagSlice.name}.`,
      evidence: `${baseEvidence} ${tagSlice.name}: ${Math.round(tagSlice.median)}% median across ${tagSlice.size}.`,
      empty: false,
    };
  }
  return { verdict: headline, evidence: baseEvidence, empty: false };
}

export function CompletionistAxisCard() {
  const completion = useLibraryCompletion();
  const owned = useSteamOwnedGames();
  const tags = useSteamTags();

  const cohort = useMemo<SteamGameCompletion[]>(() => {
    const stats = completion.data?.stats ?? [];
    return stats.filter((s) => s.unlocked > 0 && s.total > 0);
  }, [completion.data]);

  const libraryMedian = useMemo(() => {
    const pcts = cohort.map((c) => (c.unlocked / c.total) * 100);
    return median(pcts);
  }, [cohort]);

  const tagSlice = useMemo(() => {
    if (!owned.data || !tags.data) return null;
    if (cohort.length < MIN_SAMPLE) return null;
    const gameById = new Map(owned.data.games.map((g) => [g.appid, g]));
    const tagNameById = new Map(tags.data.tags.map((t) => [t.id, t.name]));
    const byTag = new Map<number, number[]>();
    for (const stat of cohort) {
      const game: SteamOwnedGame | undefined = gameById.get(stat.appid);
      if (!game) continue;
      const pct = (stat.unlocked / stat.total) * 100;
      for (const tid of game.tagIds) {
        const bucket = byTag.get(tid);
        if (bucket) bucket.push(pct);
        else byTag.set(tid, [pct]);
      }
    }
    let best: { name: string; median: number; size: number } | null = null;
    for (const [tid, pcts] of byTag) {
      if (pcts.length < MIN_TAG_SAMPLE) continue;
      const name = tagNameById.get(tid);
      if (!name) continue;
      const m = median(pcts);
      if (!best || m > best.median || (m === best.median && pcts.length > best.size)) {
        best = { name, median: m, size: pcts.length };
      }
    }
    return best;
  }, [cohort, owned.data, tags.data]);

  // Pending: hold the slot — the page below depends on it for layout
  // consistency. A null render here would shift the recent feed up and back
  // down as the query resolves.
  if (completion.isPending) {
    return <CardShell title="Completionist axis" verdict="Reading the library…" empty />;
  }
  if (completion.isError) {
    return (
      <CardShell
        title="Completionist axis"
        verdict="Couldn't read the library this time."
        empty
      />
    );
  }
  if (cohort.length < MIN_SAMPLE) {
    return (
      <CardShell
        title="Completionist axis"
        verdict="Not enough progress yet to call it."
        evidence={
          <p className="text-xs text-muted-foreground">
            Showing up after the first {MIN_SAMPLE} games with any achievement unlocked.
            Currently at {cohort.length}.
          </p>
        }
        empty
      />
    );
  }

  const { verdict, evidence } = buildVerdict(cohort, tagSlice, libraryMedian);
  return (
    <CardShell
      title="Completionist axis"
      indicator={
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.round(libraryMedian)}% · n={cohort.length}
        </span>
      }
      verdict={verdict}
      evidence={<p className="text-xs text-muted-foreground">{evidence}</p>}
    />
  );
}
