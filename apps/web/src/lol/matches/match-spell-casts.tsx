import { useSummonerSpells } from "@/lol/_shared/analytics/use-summoner-spells";
import { useChampionSpells } from "@/lol/matches/use-champion-spells";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ParticipantDetail } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.28 },
} as const;

const RICH_TOOLTIP_CLASS =
  "pointer-events-none z-50 w-max max-w-72 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

function RichCastTooltip({
  iconUrl,
  name,
  description,
  count,
}: {
  iconUrl: string;
  name: string;
  description?: string | undefined;
  count: number;
}) {
  return (
    <TooltipPrimitive.Content
      side="bottom"
      sideOffset={6}
      collisionPadding={8}
      className={RICH_TOOLTIP_CLASS}
    >
      <div className="flex items-start gap-3">
        {iconUrl && (
          <img
            src={iconUrl}
            alt=""
            aria-hidden="true"
            className="size-10 shrink-0 rounded-md bg-muted"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{name}</div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {count} cast{count === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      {description && (
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
    </TooltipPrimitive.Content>
  );
}

function CastCell({
  iconUrl,
  fallback,
  name,
  description,
  count,
}: {
  iconUrl: string;
  fallback: string;
  name: string;
  description?: string;
  count: number;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-col items-center gap-1">
          <div className="relative size-8 overflow-hidden rounded-sm border bg-background/40">
            {iconUrl ? (
              <img src={iconUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-mono text-sm font-semibold text-muted-foreground">
                {fallback}
              </span>
            )}
          </div>
          <span className="font-mono text-xs tabular-nums">{count}</span>
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <RichCastTooltip
          iconUrl={iconUrl}
          name={name || fallback}
          description={description}
          count={count}
        />
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function SummonerCastCell({ id, count }: { id: number; count: number }) {
  const spells = useSummonerSpells();
  const spell = spells?.get(id);
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-col items-center gap-1">
          <div className="size-8 overflow-hidden rounded-sm border bg-background/40">
            {spell ? (
              <img
                src={spell.iconUrl}
                alt={spell.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="inline-block size-full rounded-sm bg-muted/40" />
            )}
          </div>
          <span className="font-mono text-xs tabular-nums">{count}</span>
        </div>
      </TooltipPrimitive.Trigger>
      {spell && (
        <TooltipPrimitive.Portal>
          <RichCastTooltip
            iconUrl={spell.iconUrl}
            name={spell.name}
            description={spell.description}
            count={count}
          />
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  );
}

export function MatchSpellCasts({
  detail,
  myPuuid,
}: {
  detail: { participants: ParticipantDetail[] };
  myPuuid?: string | undefined;
}) {
  const me = myPuuid ? detail.participants.find((p) => p.puuid === myPuuid) : undefined;
  const spells = useChampionSpells(me?.championName ?? "");
  const reduced = useReducedMotion();

  if (!me?.owner) return null;
  const { spellCasts } = me.owner;
  const slots = [
    { key: "Q" as const, count: spellCasts.q, slotIndex: 0 },
    { key: "W" as const, count: spellCasts.w, slotIndex: 1 },
    { key: "E" as const, count: spellCasts.e, slotIndex: 2 },
    { key: "R" as const, count: spellCasts.r, slotIndex: 3 },
  ];

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium">Spell casts</h3>
      <div className="flex items-end gap-4 rounded-md border bg-card/60 p-3 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          {slots.map(({ key, count, slotIndex }) => {
            const info = spells?.[slotIndex];
            return (
              <CastCell
                key={key}
                iconUrl={info?.iconUrl ?? ""}
                fallback={key}
                name={info?.name ? `${key} — ${info.name}` : key}
                count={count}
              />
            );
          })}
        </div>
        <div className="h-10 w-px self-center bg-border" aria-hidden="true" />
        <div className="flex items-end gap-2">
          <SummonerCastCell id={me.summoner1Id} count={spellCasts.summoner1} />
          <SummonerCastCell id={me.summoner2Id} count={spellCasts.summoner2} />
        </div>
      </div>
    </m.section>
  );
}
