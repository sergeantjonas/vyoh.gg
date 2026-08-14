import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/**
 * Compact tooltip shell for a control whose icon doesn't say enough on its own —
 * and which may be disabled.
 *
 * The `<span>` around the trigger is load-bearing: a disabled button swallows
 * pointer events, so Radix never sees the hover and the tooltip explaining why
 * it is disabled would be the one thing you cannot read.
 */
export function ControlHint({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={4}
          className={TOOLTIP_CONTENT_COMPACT}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
