import { cn } from "@/lib/utils";
import { usePerks } from "@/lol/_shared/use-perks";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function KeystoneIcon({
  id,
  className,
}: {
  id: number;
  className?: string;
}) {
  const perks = usePerks();
  const perk = perks?.get(id);
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <span className="inline-block cursor-default">
          {perk ? (
            <img
              src={perk.iconUrl}
              alt={perk.name}
              className={cn("size-4 rounded-full", className)}
            />
          ) : (
            <span
              className={cn("inline-block size-4 rounded-full bg-muted/40", className)}
            />
          )}
        </span>
      </TooltipPrimitive.Trigger>
      {perk && (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={4}
            className="pointer-events-none z-50 rounded border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-md backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {perk.name}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  );
}
