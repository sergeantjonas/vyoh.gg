import { useActiveChampion } from "@/lol/champions/active-champion-context";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

// Mirror of MatchBreadcrumb: clicking back captures the hero's current rect so
// the destination list row can morph back to it. The hero exposes that rect
// via `data-champion-card="{alias}"` so the lookup is one querySelector away.
export function ChampionBreadcrumb({
  accountSlug,
  championAlias,
}: {
  accountSlug: string;
  championAlias: string;
}) {
  const { setOriginRect } = useActiveChampion();
  return (
    <Link
      to="/lol/$accountSlug/champions"
      params={{ accountSlug }}
      search={(prev: { queue?: number; count?: number }) => prev}
      onClick={() => {
        const heroEl = document.querySelector(`[data-champion-card="${championAlias}"]`);
        if (heroEl instanceof HTMLElement) {
          setOriginRect({
            championAlias,
            rect: heroEl.getBoundingClientRect(),
            direction: "backward",
          });
        }
      }}
      className="group inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      Champions
    </Link>
  );
}
