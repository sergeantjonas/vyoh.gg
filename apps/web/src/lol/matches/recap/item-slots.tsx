import { TOOLTIP_CONTENT_RICH } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import { ItemIcon } from "@/lol/_shared/assets/item-icon";
import { useItems } from "@/lol/matches/use-items";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { m, useReducedMotion } from "motion/react";
import { itemReveal, itemsContainer } from "./recap-motion";

function ItemSlot({ id }: { id: number }) {
  const items = useItems();
  const item = id !== 0 ? items.data?.get(id) : undefined;

  if (!item) {
    return <div className="size-5 rounded-sm bg-muted/40" />;
  }

  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <span className="inline-block cursor-default">
          <ItemIcon
            iconUrl={item.iconUrl}
            alt={item.name}
            className="size-5 rounded-sm"
          />
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className={cn(TOOLTIP_CONTENT_RICH, "max-w-sm")}
        >
          <div className="flex items-start gap-3">
            <img
              src={item.iconUrl}
              alt=""
              aria-hidden="true"
              className="size-10 shrink-0 rounded-md bg-muted"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="text-sm font-semibold leading-tight">{item.name}</div>
              {item.priceTotal ? (
                <div className="font-mono text-xs text-amber-400">{item.priceTotal}g</div>
              ) : null}
            </div>
          </div>
          {item.descriptionRich ? (
            <div
              className="item-tooltip-body mt-2 text-xs leading-relaxed text-muted-foreground"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised via toRichDescription (allowlist sanitiser + wiki→proxy src rewrite)
              dangerouslySetInnerHTML={{ __html: item.descriptionRich }}
            />
          ) : item.description ? (
            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </div>
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function ItemSlots({
  items,
  skipAnimation,
}: { items: number[]; skipAnimation?: boolean | undefined }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      variants={itemsContainer}
      initial={reduced || skipAnimation ? "show" : "hidden"}
      animate="show"
      className="flex gap-0.5"
    >
      {items.map((id, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items array has fixed positions (slots 0-6)
        <m.div key={i} variants={itemReveal}>
          <ItemSlot id={id} />
        </m.div>
      ))}
    </m.div>
  );
}
