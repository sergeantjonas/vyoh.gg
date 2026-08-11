import { TOOLTIP_CONTENT_RICH } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { isPreOrdered } from "@/steam/upcoming/bucketing";
import { PreOrderedMark } from "@/steam/upcoming/pre-ordered-mark";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { SteamUpcomingItem } from "@vyoh/shared";
import { useState } from "react";

interface ReleaseCapsuleProps {
  item: SteamUpcomingItem;
  // One-line release framing under the name in the hover card ("in 12 days",
  // "Q4 2026", "released 3 days ago"). Optional — bands that already carry a
  // band-level date label can omit it.
  detail?: string | undefined;
  // Desaturated "still wishlisted but the date slipped" treatment.
  ghost?: boolean | undefined;
  className?: string | undefined;
}

// The shared art-forward tile used by the calendar cells and the quarter/year
// bands: Steam capsule art (231×87) as an external link to the store, the title
// carried in a TooltipPrimitive hover card per the no-`title=` convention. Art,
// not glass — opaque image with a dark hover lift, no frosting (§ glass table).
export function ReleaseCapsule({ item, detail, ghost, className }: ReleaseCapsuleProps) {
  const [failed, setFailed] = useState(false);
  const name = item.name ?? `App ${item.appid}`;
  const preOrdered = isPreOrdered(item);

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <a
          href={item.storeUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={preOrdered ? `${name} on Steam — pre-ordered` : `${name} on Steam`}
          data-ghost={ghost ? "" : undefined}
          className={cn(
            "group/cap relative block aspect-[231/87] overflow-hidden rounded-md border border-border/40 bg-card outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
            ghost && "opacity-60 grayscale",
            className
          )}
        >
          {failed ? (
            <span className="flex size-full items-center justify-center px-1 text-center text-[0.6rem] font-medium leading-tight text-muted-foreground">
              {name}
            </span>
          ) : (
            <img
              src={steamCapsuleUrl(item.appid)}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="size-full object-cover"
            />
          )}
          <span className="absolute inset-0 bg-black/0 transition-colors group-hover/cap:bg-black/25" />
          {preOrdered ? <PreOrderedMark className="absolute right-1 bottom-1" /> : null}
        </a>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={6}
          className={TOOLTIP_CONTENT_RICH}
        >
          <p className="font-medium text-foreground">{name}</p>
          {detail ? <p className="mt-0.5 text-muted-foreground">{detail}</p> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/**
 * Owner-facing days-until phrasing for a day-precise release. Negative days are
 * ghosted past releases ("released N days ago").
 */
export function dayCountdownLabel(daysUntil: number): string {
  if (daysUntil > 1) return `in ${daysUntil} days`;
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil === 0) return "today";
  if (daysUntil === -1) return "released yesterday";
  return `released ${-daysUntil} days ago`;
}
