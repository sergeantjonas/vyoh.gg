import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { useChampionMastery } from "./use-champion-mastery";

// en-US for the capital suffix: en-GB's compact form writes "1.1m".
const COMPACT_POINTS = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});
const EXACT_POINTS = new Intl.NumberFormat("en-GB");
const LAST_PLAYED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

// Riot's mastery is a lifetime counter, the one number on the champion page
// that reaches back past the match history tracked here. The server render and
// the hydrating render both draw no pill; it joins the row once the query lands.
export function ChampionMasteryBadge({
  accountSlug,
  championKey,
}: {
  accountSlug: string;
  championKey: string;
}) {
  const mastery = useChampionMastery(accountSlug, championKey).data?.mastery;
  if (!mastery) return null;
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        {/* A button rather than a span so the exact figure is reachable, and
            announced, without a pointer. */}
        <button
          type="button"
          className="cursor-help whitespace-nowrap rounded-full border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
        >
          Mastery {mastery.level} · {COMPACT_POINTS.format(mastery.points)}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_COMPACT}
        >
          {EXACT_POINTS.format(mastery.points)} lifetime points · last played{" "}
          {LAST_PLAYED.format(new Date(mastery.lastPlayedAt))}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
