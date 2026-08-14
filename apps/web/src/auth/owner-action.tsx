import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const OWNER_ONLY_COPY = "Owner-only — sign in to enable.";

/**
 * Tooltip shell for a control that only the owner may press.
 *
 * The control stays rendered and disabled rather than hidden, so the page still
 * describes what it can do and the owner sees the same layout signed in or out
 * — hiding it would make the page silently change shape depending on who is
 * looking, which is the harder thing to reason about when something breaks.
 *
 * The `<span>` around the trigger is load-bearing: a disabled button swallows
 * pointer events, so Radix never sees the hover and the tooltip explaining
 * *why* it is disabled would be the one thing you cannot read.
 */
export function OwnerAction({
  isOwner,
  label,
  side = "bottom",
  children,
}: {
  isOwner: boolean;
  label: string;
  side?: "top" | "bottom";
  children: React.ReactNode;
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
          {isOwner ? label : OWNER_ONLY_COPY}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
