import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { DetectedSeason } from "@vyoh/shared";
import { detectSeasons } from "@vyoh/shared/lol/rank-history";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

type QueueKey = "solo" | "flex";

const QUEUE_LABEL: Record<QueueKey, string> = {
  solo: "Solo/Duo",
  flex: "Flex",
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
  return `https://wsrv.nl/?url=${src}&w=72&trim=10&output=webp&q=85`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(startAt: string, endAt: string): string {
  return `${formatDate(startAt)} – ${formatDate(endAt)}`;
}

function tierColor(tier: string): string {
  return TIER_COLOR[tier.toUpperCase()] ?? "text-foreground";
}

function shortRank(tier: string, rank: string, lp: number): string {
  const t = tier.toUpperCase();
  const display = t.charAt(0) + t.slice(1).toLowerCase();
  if (APEX_TIERS.has(t)) return `${display} ${lp}LP`;
  return `${display} ${rank} ${lp}LP`;
}

function QueueTabs({
  value,
  onChange,
  available,
}: {
  value: QueueKey;
  onChange: (v: QueueKey) => void;
  available: Record<QueueKey, boolean>;
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
      {(["solo", "flex"] as const).map((q) => {
        const disabled = !available[q];
        const active = value === q;
        return (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onChange(q)}
            className={cn(
              "cursor-pointer rounded px-2.5 py-1 transition-colors",
              active
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
            )}
          >
            {QUEUE_LABEL[q]}
          </button>
        );
      })}
    </div>
  );
}

function SeasonRow({
  season,
  index,
  reduced,
}: {
  season: DetectedSeason;
  index: number;
  reduced: boolean;
}) {
  const endTier = season.endRank.tier.toUpperCase();
  const peakTier = season.peakRank.tier.toUpperCase();
  const endLabel = season.ongoing ? "Currently" : "Ended";

  return (
    <m.li
      initial={reduced ? {} : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduced ? 0 : index * 0.04 }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2.5",
        season.ongoing && "border-primary/30 bg-primary/5"
      )}
    >
      <img
        src={rankedEmblemUrl(endTier)}
        alt={endTier}
        loading="lazy"
        className="size-9 shrink-0 object-contain opacity-90 drop-shadow-sm"
      />
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className={cn("text-sm font-semibold", tierColor(endTier))}>
            {endLabel}:{" "}
            {shortRank(endTier, season.endRank.rank, season.endRank.leaguePoints)}
          </div>
          {season.ongoing && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Active
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatRange(season.startAt, season.endAt)}
        </div>
        {season.peakRank.totalLp > season.endRank.totalLp && (
          <div className="text-xs text-muted-foreground">
            Peak:{" "}
            <span className={tierColor(peakTier)}>
              {shortRank(peakTier, season.peakRank.rank, season.peakRank.leaguePoints)}
            </span>
          </div>
        )}
      </div>
    </m.li>
  );
}

export function ProfileSeasonHistory({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const [queue, setQueue] = useState<QueueKey>("solo");
  const reduced = useReducedMotion();

  const history = useRankHistory(account, "season");

  const seasons = useMemo<Record<QueueKey, DetectedSeason[]>>(
    () => ({
      solo: detectSeasons(history.data?.solo ?? []),
      flex: detectSeasons(history.data?.flex ?? []),
    }),
    [history.data]
  );

  const available = useMemo<Record<QueueKey, boolean>>(
    () => ({
      solo: seasons.solo.length > 0,
      flex: seasons.flex.length > 0,
    }),
    [seasons]
  );

  const activeQueue: QueueKey = available[queue]
    ? queue
    : available.solo
      ? "solo"
      : "flex";

  const list = seasons[activeQueue];
  // Reverse chronological: ongoing first, then most-recently-closed.
  const sorted = useMemo(() => [...list].reverse(), [list]);
  const hasPastSeasons = list.length > 1;
  const firstSnapshot = list[0]?.startAt;

  if (history.isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Season history
        </div>
        <div className="h-20 animate-pulse rounded-md border bg-muted/30" />
      </section>
    );
  }

  if (list.length === 0) {
    return null;
  }

  return (
    <m.section
      className="flex flex-col gap-3"
      initial={reduced ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Season history
          </div>
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <span className="cursor-help rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                self-tracked
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={4}
                className={TOOLTIP_CONTENT_CLASS}
              >
                Splits detected from self-collected snapshots — Riot does not expose
                historical season ranks.
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </div>
        <QueueTabs value={activeQueue} onChange={setQueue} available={available} />
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <m.ul
          key={activeQueue}
          initial={reduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? {} : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-2"
        >
          {sorted.map((season, i) => (
            <SeasonRow
              key={season.startAt}
              season={season}
              index={i}
              reduced={reduced ?? false}
            />
          ))}
        </m.ul>
      </AnimatePresence>

      {!hasPastSeasons && firstSnapshot && (
        <p className="text-xs text-muted-foreground">
          Tracking started {formatDate(firstSnapshot)}. Past seasons will appear here once
          Riot resets ranks — typically every ~3 months. Riot doesn't expose pre-tracking
          history via their API.
        </p>
      )}
    </m.section>
  );
}
