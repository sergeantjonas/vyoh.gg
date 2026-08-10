import { ChapterLabel } from "@/components/ui/chapter-label";
import { normalizeChampionAlias } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import {
  type LolAccount,
  OWNER_TIME_ZONE,
  excludeRemakes,
  renderSeasonRidge,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

// The full cached history, not the recap's 20-match layout window — the walk
// only carries a narrative at season length. Same count as the champion
// table's window so the two surfaces share one Query cache entry (~350 kB,
// client-only; see the do-not-prime note on useCachedMatchesWindow).
const ARTWORK_WINDOW_COUNT = 2000;

const RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

/**
 * The season thread: the whole match history as one artwork — the cumulative
 * win/loss walk from `renderSeasonRidge()`, one segment per game, colored by
 * champion. An identity surface rather than an analysis one, so it reads all
 * queues instead of `useSeriousMatches()`: every game played is part of the
 * thread, and remakes are the only exclusion.
 */
export function RecapSeasonThread({ account }: { account: LolAccount | undefined }) {
  const reduced = useReducedMotion();
  const { data, isPending } = useCachedMatchesWindow(account, ARTWORK_WINDOW_COUNT);
  const matches = data?.matches;

  const thread = useMemo(() => {
    if (!matches) return null;
    const played = excludeRemakes(matches).sort(
      (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt)
    );
    const first = played[0];
    const last = played[played.length - 1];
    if (!first || !last) return null;
    return {
      svg: renderSeasonRidge(
        played.map((match) => ({
          win: match.win,
          kills: match.kills,
          colorHex: championTheme(match.champion).dominantHex,
        }))
      ),
      games: played.length,
      champions: new Set(played.map((p) => normalizeChampionAlias(p.champion))).size,
      from: RANGE_FMT.format(new Date(first.playedAt)),
      to: RANGE_FMT.format(new Date(last.playedAt)),
    };
  }, [matches]);

  if (isPending) {
    return (
      <section aria-hidden="true" className="flex flex-col gap-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
        <div className="aspect-[40/21] w-full animate-pulse rounded-lg bg-muted/20" />
        <div className="h-3 w-72 max-w-full animate-pulse rounded bg-muted/30" />
      </section>
    );
  }
  if (!thread) return null;

  return (
    // The section owns the single in-view trigger and propagates the variant
    // to the children. The artwork child must NOT carry its own whileInView:
    // its hidden state is fully clipped, a zero-visible-area element never
    // intersects, and the animation that would unclip it never starts.
    <m.section
      initial={reduced ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: { opacity: 0, y: 32 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] },
        },
      }}
      className="flex flex-col gap-4"
    >
      <ChapterLabel>The season thread</ChapterLabel>
      <m.div
        role="img"
        aria-label={`Season artwork: the cumulative win/loss walk of ${thread.games} games, one segment per game, colored by champion.`}
        variants={{
          // Keyframes must agree on units — a unitless 0 next to 100% is not
          // interpolable, and Motion holds the fully-clipped initial state
          // without logging anything.
          hidden: { clipPath: "inset(0% 100% 0% 0%)" },
          visible: {
            clipPath: "inset(0% 0% 0% 0%)",
            transition: { duration: 1.4, delay: 0.25, ease: [0.32, 0.72, 0, 1] },
          },
        }}
        className="w-full [&_svg]:h-auto [&_svg]:w-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: renderSeasonRidge emits only numbers and safeHex()-guarded colors into its markup
        dangerouslySetInnerHTML={{ __html: thread.svg }}
      />
      <m.p
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { duration: 0.6, delay: 1.1, ease: "easeOut" },
          },
        }}
        className="text-xs text-muted-foreground/70"
      >
        {thread.games} games · {thread.champions} champions · {thread.from} → {thread.to}.
        Wins climb, losses fall; knots mark the five biggest kill games.
      </m.p>
    </m.section>
  );
}
