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
            className="pointer-events-none z-50 w-max max-w-72 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
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
