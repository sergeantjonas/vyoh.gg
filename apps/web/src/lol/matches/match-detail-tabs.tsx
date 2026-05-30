import type { SectionTab } from "@/_shared/section-layout/section-nav";
import { Activity, ScrollText, Sparkles, UserRound } from "lucide-react";

// The match-detail sub-tabs. Model 3 renders these in the always-on section
// strip (via `buildMatchDetailSectionTabs` → SectionShell `tabs`), so each
// entry carries an Icon to match the section tabs' icon+label treatment.
export const MATCH_DETAIL_TABS = [
  { id: "recap", label: "Recap", Icon: ScrollText },
  { id: "your-game", label: "Your game", Icon: UserRound },
  { id: "review", label: "Review", Icon: Sparkles },
  { id: "timeline", label: "Timeline", Icon: Activity },
] as const;

export type MatchDetailTabId = (typeof MATCH_DETAIL_TABS)[number]["id"];

export const TAB_TO_ROUTE = {
  recap: "/lol/$accountSlug/matches/$matchId/recap",
  "your-game": "/lol/$accountSlug/matches/$matchId/your-game",
  review: "/lol/$accountSlug/matches/$matchId/review",
  timeline: "/lol/$accountSlug/matches/$matchId/timeline",
} as const;

// Derives the active sub-tab from a detail pathname. The index route redirects
// to /recap, so a settled detail URL always lands on one of the four segments —
// fall back to "recap" only for the brief frame before the redirect runs.
export function activeMatchDetailTab(
  pathname: string,
  matchId: string
): MatchDetailTabId {
  const after = pathname.split(`/matches/${matchId}`)[1] ?? "";
  const trimmed = after.replace(/^\/+|\/+$/g, "");
  if (trimmed === "your-game") return "your-game";
  if (trimmed === "review") return "review";
  if (trimmed === "timeline") return "timeline";
  return "recap";
}

// Builds the detail sub-tabs as SectionShell descriptors. Model 3: on a detail
// page the always-on section strip's tab row carries these (not the section
// tabs), with the `‹ Matches` breadcrumb in the strip's leading slot standing
// in for section scope. `replace: true` keeps the whole detail page a single
// back-button entry regardless of which sub-tab is open.
export function buildMatchDetailSectionTabs({
  accountSlug,
  matchId,
  activeTabId,
}: {
  accountSlug: string;
  matchId: string;
  activeTabId: MatchDetailTabId;
}): SectionTab[] {
  return MATCH_DETAIL_TABS.map(({ id, label, Icon }) => ({
    to: TAB_TO_ROUTE[id],
    params: { accountSlug, matchId },
    replace: true,
    label,
    Icon,
    active: id === activeTabId,
  }));
}
