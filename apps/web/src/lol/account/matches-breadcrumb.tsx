import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { ComponentType } from "react";

const MATCHES_ROUTE = "/lol/$accountSlug/matches";

export type BreadcrumbSection = {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

// The section strip's leading slot on a match-detail page (Model 3). A split
// breadcrumb-switcher standing in for section scope where the Matches tab used
// to be: the `‹ Matches` label is a one-click return to the list (the most
// common move, so it stays cheap + prominent, and seeds the card-morph back via
// the same `setOriginRect` the match cards set on the way in); the appended
// caret opens the sibling sections (Profile/Trends/Champions) so jumping out of
// a match isn't a forced two-hop through the list. GitHub/VS Code breadcrumb
// idiom — segment navigates, caret reveals siblings. `sections` is injected by
// the route so the canonical section list stays in one place.
export function MatchesBreadcrumb({
  accountSlug,
  matchId,
  sections,
}: {
  accountSlug: string;
  matchId: string;
  sections: readonly BreadcrumbSection[];
}) {
  const { setOriginRect } = useActiveMatch();
  // The Matches section icon (clock), so the breadcrumb carries a leading glyph
  // like every detail tab beside it instead of reading as bare text.
  const MatchesIcon = sections.find((s) => s.to === MATCHES_ROUTE)?.Icon;
  // One cohesive breadcrumb-switcher unit: the "Matches" label is the one-click
  // back link, the single trailing caret opens the section menu. Dropping a
  // back-pointing `‹` next to a down-pointing `⌄` (the two fought visually) for
  // the GitHub/VS Code breadcrumb-segment look — segment label navigates, the
  // lone caret reveals siblings.
  return (
    <div className="flex items-center text-sm text-muted-foreground">
      <Link
        to={MATCHES_ROUTE}
        params={{ accountSlug }}
        search={(prev: { queue?: number; count?: number }) => prev}
        onClick={() => {
          const heroEl = document.querySelector(`[data-match-card="${matchId}"]`);
          if (heroEl instanceof HTMLElement) {
            setOriginRect({
              matchId,
              rect: heroEl.getBoundingClientRect(),
              direction: "backward",
            });
          }
        }}
        className="inline-flex items-center gap-1.5 rounded px-1 transition-colors hover:text-foreground"
      >
        {MatchesIcon && <MatchesIcon className="size-4" />}
        Matches
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Switch section"
            className="flex cursor-pointer items-center rounded p-0.5 transition-colors hover:text-foreground data-[state=open]:text-foreground"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[11rem]">
          {sections.map(({ to, label, Icon }) => {
            // We're under /matches on a detail page, so Matches is the current
            // section — flag it like the section dropdown does.
            const active = to === MATCHES_ROUTE;
            return (
              <DropdownMenuItem key={to} asChild>
                <Link
                  to={to as never}
                  params={{ accountSlug } as never}
                  search={((prev: Record<string, unknown>) => prev) as never}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-theme-strong" : "text-muted-foreground"
                    )}
                  />
                  <span className={active ? "font-semibold" : undefined}>{label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
