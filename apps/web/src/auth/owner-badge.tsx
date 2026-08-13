import { LogoutButton } from "./logout-button";
import { useViewer } from "./use-viewer";

/**
 * The only chrome that says a session exists. Renders nothing at all for
 * anonymous visitors — they have no reason to discover that a login exists, and
 * an always-visible "Log in" affordance on a single-owner site is an invitation
 * to try.
 *
 * Appears after hydration rather than in the server-rendered markup, because
 * `useViewer` is client-only by design (see its doc comment). The nav reserves
 * no space for it: it only ever appears for one person, so a layout shift on
 * their own visits is a better trade than a permanent gap on everyone else's.
 */
export function OwnerBadge() {
  const { data: viewer } = useViewer();
  if (viewer?.isOwner !== true) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="hidden sm:inline">@{viewer.login}</span>
      <LogoutButton />
    </span>
  );
}
