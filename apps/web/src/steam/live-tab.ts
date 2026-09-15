import type { SectionLiveTab } from "@/_shared/section-layout/section-nav";
import type { SteamPlayerState } from "@vyoh/shared";

// The tab strip's live chip while a game is open: the same red chip the LoL
// section shows for a live match, reworded and pointed at the sessions page.
// Reads the presence poll, which is also what the sessions hero's own live
// state is gated on, so the chip and the hero agree.
export function steamLiveTab(
  playerState: SteamPlayerState | undefined,
  pathname: string
): SectionLiveTab | undefined {
  const game = playerState?.currentGame;
  if (!game) return undefined;
  return {
    to: "/steam/sessions",
    active: pathname === "/steam/sessions",
    label: "Playing",
    ariaLabel: `Playing ${game.name}`,
  };
}
