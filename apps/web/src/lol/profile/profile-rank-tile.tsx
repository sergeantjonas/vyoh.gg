import type { RankEntry } from "@vyoh/shared";
import { Flame } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";

const loadedEmblems = new Set<string>();

const QUEUE_LABEL: Record<string, string> = {
  RANKED_SOLO_5x5: "Ranked Solo",
  RANKED_FLEX_SR: "Ranked Flex",
};

const TIER_COLOR: Record<string, string> = {
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

const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

function rankedEmblemUrl(tier: string): string {
  const name = tier.toLowerCase();
  const src = `raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${name}.png`;
  return `https://wsrv.nl/?url=${src}&w=160&trim=10&output=webp&q=90`;
}

function RankTileContent({ entry }: { entry: RankEntry }) {
  const emblemUrl = rankedEmblemUrl(entry.tier);
  const [emblemLoaded, setEmblemLoaded] = useState(() => loadedEmblems.has(emblemUrl));
  const tierColor = TIER_COLOR[entry.tier] ?? "text-foreground";
  const label = QUEUE_LABEL[entry.queueId] ?? entry.queueId;
  const division = APEX_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;

  const wins = entry.wins;
  const losses = entry.losses;
  const total = wins != null && losses != null ? wins + losses : null;
  const pct =
    total != null && total > 0 && wins != null ? Math.round((wins / total) * 100) : null;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex flex-1 items-center gap-3 rounded-lg border bg-card/50 p-4"
    >
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {entry.hotStreak && (
            <Flame className="size-3 text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]" />
          )}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${tierColor}`}>
          {entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()}
          {division}
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {entry.leaguePoints} LP
        </div>
        {wins != null && losses != null && (
          <span className="text-sm text-muted-foreground">
            {wins}W {losses}L{pct != null ? ` · ${pct}%` : ""}
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
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-muted-foreground">Unranked</div>
    </div>
  );
}

export function ProfileRankTiles({ entries }: { entries: RankEntry[] }) {
  const byQueue = new Map(entries.map((e) => [e.queueId, e]));
  const queues = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"];

  return (
    <div className="flex gap-4">
      {queues.map((queueId) => {
        const entry = byQueue.get(queueId);
        return entry ? (
          <RankTileContent key={queueId} entry={entry} />
        ) : (
          <UnrankedTile key={queueId} queueId={queueId} />
        );
      })}
    </div>
  );
}
