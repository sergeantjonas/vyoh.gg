import { Link } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";

// The avatar and name in a section strip, as the link to that section's
// profile. Neither strip carries a Profile tab — a seventh Steam tab pushed
// the identity onto a row of its own, and LoL followed for parity — so this
// is the way back from any other tab. The hover affordance lives on the name
// rather than the whole link: the avatar and name carry view-transition
// names for the identity morph, and a faded ancestor at click time would be
// captured as the morph's starting frame.
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
      className="flex items-center gap-3 rounded-md decoration-border/80 underline-offset-4 hover:[&_[data-identity-name]]:underline"
    >
      {children}
    </Link>
  );
}
