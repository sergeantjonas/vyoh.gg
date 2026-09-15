import { Crown, History, LayoutDashboard, TrendingUp } from "lucide-react";

// The LoL section's tabs, in strip order. No Profile entry: the avatar and
// name in the strip are the link to the profile, the same shape the Steam
// strip settled on when a seventh tab pushed its identity onto a row of its
// own. The slide classifier keeps its own order with the index in it
// (`LOL_TAB_ORDER` in navigation-type.ts), as Steam's `STEAM_TAB_SEGMENTS`
// does beside `STEAM_STRIP_SEGMENTS`.
export const LOL_STRIP_TABS = [
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History, exact: false },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp, exact: false },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown, exact: false },
] as const;

/** The profile as a tab, for the narrow-viewport dropdown only: it names the current section when the landing route is open. */
export const LOL_PROFILE_TAB = {
  to: "/lol/$accountSlug",
  label: "Profile",
  Icon: LayoutDashboard,
  exact: true,
} as const;
