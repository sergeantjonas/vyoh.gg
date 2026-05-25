import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useActiveGame } from "@/steam/library/active-game-context";
import { useLibraryPrefs } from "@/steam/library/use-library-prefs";
import { Link } from "@tanstack/react-router";

// Mirror of ChampionBreadcrumb / MatchBreadcrumb: clicking back captures the
// hero + logo rects so the destination row can morph the two elements back
// into place. Two anchors instead of one because the forward direction also
// pairs two view-transition names (`steam-game-${appid}-hero` and
// `-logo`), so the backward morph mirrors that two-element shape.
//
// Tile layout intentionally skips the morph (visual intent is preserved by
// the existing forward VT; back-nav just needs scroll restoration).
export function GameBreadcrumb({
  appid,
  gameName,
}: {
  appid: number;
  gameName: string;
}) {
  const { setOriginRect } = useActiveGame();
  const [{ layout }] = useLibraryPrefs();
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link
              to="/steam/library"
              // Opt out of TanStack Router's `defaultViewTransition`. The
              // library row drives its own mount-time FLIP morph (see
              // library-row.tsx); letting the router also fire a VT means
              // the LI's `library-row-${appid}` fades in via a snapshot
              // pseudo-element that hides the real DOM. The manual morph
              // runs INVISIBLE behind that pseudo for the VT's first ~300ms,
              // then the pseudo is removed mid-morph and the user sees the
              // remaining frames erratically — including a dark `bg-card`
              // gap where the hero IMG is currently translated away from
              // its row slot. Disabling the router VT lets the manual morph
              // play from frame 0 in the real DOM.
              viewTransition={false}
              onClick={() => {
                if (layout !== "rows") return;
                const heroEl = document.querySelector(
                  `[data-steam-game-hero="${appid}"]`
                );
                if (!(heroEl instanceof HTMLElement)) return;
                const logoEl = document.querySelector(
                  `[data-steam-game-logo="${appid}"]`
                );
                setOriginRect({
                  appid,
                  heroRect: heroEl.getBoundingClientRect(),
                  // Null when the detail page rendered the text-fallback
                  // `<h2>` (logoFailed branch). The chrome-morph carries
                  // the row's logo with it, so no separate logo rect is
                  // needed for the backward animation — but keeping the
                  // field on the origin shape lets a future variant pick
                  // it up without a context-type change.
                  logoRect:
                    logoEl instanceof HTMLElement ? logoEl.getBoundingClientRect() : null,
                  direction: "backward",
                });
              }}
            >
              Library
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{gameName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
