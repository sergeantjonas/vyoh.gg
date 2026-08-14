import { ControlHint } from "@/components/ui/control-hint";
import type { ReactNode } from "react";

export const OWNER_ONLY_COPY = "Owner-only — sign in to enable.";

/**
 * Tooltip shell for a control that only the owner may press: the same hint every
 * other control gets, swapped for an explanation when there is no session behind
 * it.
 *
 * The control stays rendered and disabled rather than hidden, so the page still
 * describes what it can do and the owner sees the same layout signed in or out.
 * That trade only pays where the surrounding data is worth reading anyway —
 * roster *management* is gated at the section instead, since a locked copy of
 * the nav's own account list tells a visitor nothing.
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
  children: ReactNode;
}) {
  return (
    <ControlHint label={isOwner ? label : OWNER_ONLY_COPY} side={side}>
      {children}
    </ControlHint>
  );
}
