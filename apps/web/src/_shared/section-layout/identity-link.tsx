import { Link } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";

// The avatar and name in a section strip, as the link to that section's
// profile. Neither strip carries a Profile tab — a seventh Steam tab pushed
// the identity onto a row of its own, and LoL followed for parity — so this
// is the way back from any other tab. Hover reads the way a tab's does — a
// colour lift from slightly muted to full, on the name and on the avatar's
// ring — and never touches the link's own opacity: the avatar and name carry
// view-transition names for the identity morph, and a faded ancestor at click
// time would be captured as the morph's starting frame. The styles reach the
// children through their `data-identity-*` markers so the two callers keep
// their own markup.
export function IdentityLink({
  to,
  params,
  preserveSearch = false,
  label,
  onClick,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  preserveSearch?: boolean;
  /** Accessible name; includes the display name when it is known. */
  label: string;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={
        (preserveSearch ? (prev: Record<string, unknown>) => prev : undefined) as never
      }
      aria-label={label}
      onClick={onClick}
      className="flex items-center gap-3 rounded-md [&_[data-identity-avatar]]:transition-[box-shadow,width,height] [&_[data-identity-name]]:text-foreground/85 [&_[data-identity-name]]:transition-colors hover:[&_[data-identity-avatar]]:ring-foreground/45 hover:[&_[data-identity-name]]:text-foreground"
    >
      {children}
    </Link>
  );
}
