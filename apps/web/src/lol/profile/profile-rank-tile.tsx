import { HeroLabel, HeroNumber } from "@/components/ui/hero-number";
import { Sparkline } from "@/components/ui/sparkline";
import { rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import { type RankEntry, formatPercent } from "@vyoh/shared";
import { Flame } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";

const loadedEmblems = new Set<string>();

const QUEUE_LABEL: Record<string, string> = {
  RANKED_SOLO_5x5: "Ranked Solo",
  RANKED_FLEX_SR: "Ranked Flex",
};

// Exported so the identity hero's tier text uses the exact same palette as
// these tiles — a single source of truth keeps the two surfaces from drifting.
export const TIER_COLOR: Record<string, string> = {
  IRON: "text-slate-400",
  BRONZE: "text-orange-500",
  SILVER: "text-slate-300",
  GOLD: "text-amber-400",
  PLATINUM: "text-teal-300",
  EMERALD: "text-emerald-400",
  DIAMOND: "text-sky-400",
  MASTER: "text-violet-400",
  GRANDMASTER: "text-rose-400",
  CHALLENGER: "text-yellow-300",
};

// Tier-tinted glow bloom (bg-* mirror of TIER_COLOR's hues) for the emblem's
// backlight in the hero rank moment. Kept beside TIER_COLOR so the colour pair
// stays in sync — same hue family, the `bg-` form for the blurred bloom.
export const TIER_GLOW: Record<string, string> = {
  IRON: "bg-slate-400",
  BRONZE: "bg-orange-500",
  SILVER: "bg-slate-300",
  GOLD: "bg-amber-400",
  PLATINUM: "bg-teal-300",
  EMERALD: "bg-emerald-400",
  DIAMOND: "bg-sky-400",
  MASTER: "bg-violet-400",
  GRANDMASTER: "bg-rose-400",
  CHALLENGER: "bg-yellow-300",
};

const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

function RankTileContent({
  entry,
  recentLp,
}: {
  entry: RankEntry;
  // Normalized-LP series for the last ~30 days of this queue, oldest first.
  // Normalization (see normalizeLp in @vyoh/shared) collapses tier/division into
  // a single ordinal so promotions and demotions don't break the visual line.
  // Skipped when fewer than 5 points are available.
  recentLp?: number[] | undefined;
}) {
  const emblemYear = useRankedEmblemYear();
  const emblemUrl = rankEmblemUrl(entry.tier, emblemYear);
  const [emblemLoaded, setEmblemLoaded] = useState(() => loadedEmblems.has(emblemUrl));
  const tierColor = TIER_COLOR[entry.tier] ?? "text-foreground";
  const label = QUEUE_LABEL[entry.queueId] ?? entry.queueId;
  const division = APEX_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;

  const wins = entry.wins;
  const losses = entry.losses;
  const total = wins != null && losses != null ? wins + losses : null;
  const pct =
    total != null && total > 0 && wins != null ? formatPercent(wins / total) : null;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex flex-1 items-center gap-3 rounded-lg border bg-card/50 p-4"
    >
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <HeroLabel>{label}</HeroLabel>
          {entry.hotStreak && (
            <Flame className="size-3 text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]" />
          )}
        </div>
        <HeroNumber size="md" className={tierColor}>
          {entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()}
          {division}
        </HeroNumber>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>{entry.leaguePoints} LP</span>
          {recentLp && recentLp.length >= 5 && (
            <Sparkline
              data={recentLp}
              width={48}
              height={12}
              className={tierColor}
              stroke="currentColor"
              aria-label={`LP trend, last ${recentLp.length} snapshots`}
              tooltip={
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">LP trend</span>
                  <span className="text-muted-foreground">
                    last {recentLp.length} snapshots
                  </span>
                  <span className="font-mono tabular-nums">
                    {recentLp[0]} → {recentLp[recentLp.length - 1]} (min{" "}
                    {Math.min(...recentLp)} · max {Math.max(...recentLp)})
                  </span>
                </div>
              }
            />
          )}
        </div>
        {wins != null && losses != null && (
          <span className="text-sm text-muted-foreground">
            {wins}W {losses}L{pct != null ? ` · ${pct}` : ""}
          </span>
        )}
      </div>
      <div className="relative size-20 shrink-0">
        {!emblemLoaded && (
          <div className="absolute inset-0 animate-pulse rounded-full bg-muted" />
        )}
        <img
          src={emblemUrl}
          alt={entry.tier}
          loading="eager"
          onLoad={() => {
            loadedEmblems.add(emblemUrl);
            setEmblemLoaded(true);
          }}
          className={
            emblemLoaded
              ? "size-20 object-contain opacity-90 drop-shadow-md transition-opacity duration-300"
              : "size-20 object-contain opacity-0 transition-opacity duration-300"
          }
        />
      </div>
    </m.div>
  );
}

function UnrankedTile({ queueId }: { queueId: string }) {
  const label = QUEUE_LABEL[queueId] ?? queueId;
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border bg-card/50 p-4 opacity-50">
      <HeroLabel>{label}</HeroLabel>
      <HeroNumber size="md" className="text-muted-foreground">
        Unranked
      </HeroNumber>
    </div>
  );
}

export function ProfileRankTiles({
  entries,
  recentLpByQueue,
}: {
  entries: RankEntry[];
  // Per-queue normalized-LP series for the last ~30 days, oldest first.
  // Optional so callers without rank history (or before the second query
  // settles) can render the tile shell immediately without a placeholder.
  recentLpByQueue?: Record<string, number[]> | undefined;
}) {
  const byQueue = new Map(entries.map((e) => [e.queueId, e]));
  const queues = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"];

  return (
    <div className="flex gap-4">
      {queues.map((queueId) => {
        const entry = byQueue.get(queueId);
        return entry ? (
          <RankTileContent
            key={queueId}
            entry={entry}
            recentLp={recentLpByQueue?.[queueId]}
          />
        ) : (
          <UnrankedTile key={queueId} queueId={queueId} />
        );
      })}
    </div>
  );
}
