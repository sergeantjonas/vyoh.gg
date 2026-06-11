import { TOOLTIP_CONTENT_RICH } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import { useSummonerSpells } from "@/lol/_shared/analytics/use-summoner-spells";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function SummonerSpellIcon({
  id,
  className,
}: {
  id: number;
  className?: string;
}) {
  const spells = useSummonerSpells();
  const spell = spells?.get(id);
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <span className="inline-block cursor-default">
          {spell ? (
            <img
              src={spell.iconUrl}
              alt={spell.name}
              className={cn("size-4 rounded-sm", className)}
            />
          ) : (
            <span
              className={cn("inline-block size-4 rounded-sm bg-muted/40", className)}
            />
          )}
        </span>
      </TooltipPrimitive.Trigger>
      {spell && (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            collisionPadding={8}
            className={cn(TOOLTIP_CONTENT_RICH, "max-w-72")}
          >
            <div className="flex items-start gap-3">
              <img
                src={spell.iconUrl}
                alt=""
                aria-hidden="true"
                className="size-10 shrink-0 rounded-md bg-muted"
              />
              <div className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                {spell.name}
              </div>
            </div>
            {spell.description && (
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {spell.description}
              </div>
            )}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  );
}
