import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { SteamGameRating } from "@vyoh/shared";

// Editorial-only chip for the storefront age-rating block (ESRB / PEGI /
// USK / …). A null rating is meaningful upstream (AO-rated titles skip ESRB
// submission entirely) but is NOT a maturity signal — see
// docs/working-notes/steam/library-card-enrichment.md for the explicit
// no-NSFW-gating decision.
//
// Body name + rating sit in the main chip ("ESRB M", "PEGI 18"). When
// descriptors are present, an extra "+N" pill appears with a Radix tooltip
// listing the full set — matches the storefront's own descriptor-list
// affordance without needing a click-through.
export function GameRatingBadge({
  rating,
  className,
}: {
  rating: SteamGameRating | null;
  className?: string;
}) {
  if (rating === null) return null;
  const descriptors = rating.descriptors;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 bg-foreground/5 px-2 py-1 text-xs font-semibold tracking-wide text-foreground/85">
        <span className="opacity-70">{rating.type}</span>
        <span>{rating.rating}</span>
      </span>
      {descriptors.length > 0 && (
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label={`Content descriptors: ${descriptors.join(", ")}`}
              className="inline-flex cursor-help items-center rounded-md border border-foreground/15 bg-foreground/5 px-1.5 py-1 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              +{descriptors.length}
            </button>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="bottom"
              sideOffset={6}
              className="pointer-events-none z-50 max-w-xs rounded-md border bg-popover/90 px-2 py-1.5 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
            >
              <ul className="flex flex-col gap-0.5">
                {descriptors.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      )}
    </span>
  );
}
