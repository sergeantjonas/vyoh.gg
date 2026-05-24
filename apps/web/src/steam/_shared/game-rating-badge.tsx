import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { SteamGameRating } from "@vyoh/shared";

// Editorial-only chip for the storefront age-rating block (ESRB / PEGI /
// USK / …). A null rating is meaningful upstream (AO-rated titles skip ESRB
// submission entirely) but is NOT a maturity signal — see
// docs/working-notes/steam/library-card-enrichment.md for the explicit
// no-NSFW-gating decision.
//
// One trigger / one tooltip: the whole chip is the hover surface, and the
// tooltip body covers body+rating, required age, and the full descriptor
// list. A separate "+N" descriptor pill (the earlier shape) created two
// adjacent hover surfaces and read as visual noise.
export function GameRatingBadge({
  rating,
  className,
}: {
  rating: SteamGameRating | null;
  className?: string;
}) {
  if (rating === null) return null;
  // Defence-in-depth: rows persisted before the projector's empty-string
  // guard could carry `type` set with `rating` empty (or vice versa), which
  // renders as a body name with no value next to it. Drop the chip rather
  // than render a half-filled badge.
  if (!rating.type || !rating.rating) return null;
  const ageSuffix = rating.requiredAge > 0 ? ` · Ages ${rating.requiredAge}+` : "";
  const descriptors = rating.descriptors;
  const hasDescriptors = descriptors.length > 0;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`${rating.type} ${rating.rating} rating${ageSuffix}${
            hasDescriptors ? `, descriptors: ${descriptors.join(", ")}` : ""
          }`}
          className={cn(
            "inline-flex cursor-help items-center gap-1.5 rounded-md border border-foreground/15 bg-foreground/5 px-2 py-1 text-xs font-semibold tracking-wide text-foreground/85 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            className
          )}
        >
          <span className="uppercase opacity-70">{rating.type}</span>
          <span className="uppercase">{rating.rating}</span>
          {hasDescriptors && (
            <span aria-hidden className="opacity-50">
              +{descriptors.length}
            </span>
          )}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          sideOffset={6}
          className="pointer-events-none z-50 max-w-xs rounded-md border bg-popover/90 px-2.5 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <p className="font-semibold">
            {rating.type} {rating.rating}
            {ageSuffix}
          </p>
          {hasDescriptors && (
            <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
              {descriptors.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
