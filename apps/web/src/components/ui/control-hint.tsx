import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
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
  className,
  children,
}: {
  label: string;
  side?: "top" | "bottom";
  /**
   * Layout classes for the trigger span.
   *
   * This span — not the control inside it — is the element Radix measures and
   * the one a flex or grid parent lays out, so positioning classes have to land
   * here. Styling the inner control instead leaves the span free to stretch,
   * and the tooltip anchors to the stretched box: in a tall `items-stretch`
   * row that puts the hint a full row above the button it belongs to.
   */
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span className={cn("inline-flex", className)}>{children}</span>
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
