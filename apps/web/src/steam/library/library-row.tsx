import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { SteamGameRowShell } from "@/steam/_shared/steam-game-row";
import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useRef } from "react";

const DAY_MS = 86_400_000;
const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function relativeTimeAgo(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / DAY_MS);
  if (Math.abs(days) < 30) return relativeTime.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return relativeTime.format(months, "month");
  const years = Math.round(days / 365);
  return relativeTime.format(years, "year");
}

export function LibraryRow({ game }: { game: SteamOwnedGame }) {
  const navigate = useNavigate();
  // Two-element morph: hero img + logo img each carry a unique
  // view-transition-name on click, pairing with matching names on the
  // destination game page. Both refs can be null when their img has
  // fallen back to a text/error branch — null-checked below; that layer
  // then simply crossfades via the root transition.
  const heroRef = useRef<HTMLImageElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  const lifetime =
    game.playtimeForeverMinutes > 0 ? formatPlaytime(game.playtimeForeverMinutes) : null;
  const twoWeeks =
    game.playtime2WeeksMinutes !== null && game.playtime2WeeksMinutes > 0
      ? formatPlaytime(game.playtime2WeeksMinutes)
      : null;
  // "Last played 6mo ago" hint for gone-quiet titles. Suppressed when the
  // 2-week marker is set — the latter already signals "active right now,"
  // and stacking both reads as noise on hot rows.
  const lastPlayed =
    game.rtimeLastPlayedAt !== null && twoWeeks === null
      ? relativeTimeAgo(game.rtimeLastPlayedAt)
      : null;

  return (
    <li>
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(game.appid) }}
        onMouseEnter={() => prefetchSteamGameBackdrop(game.appid, game.assetTimestamp)}
        onFocus={() => prefetchSteamGameBackdrop(game.appid, game.assetTimestamp)}
        onClick={(e) => {
          // Apply `view-transition-name` to each available morph anchor
          // (hero + logo) so both are present at OLD-snapshot capture,
          // then clear them inside the callback BEFORE awaiting navigation
          // so neither collides with the destination's matching names at
          // NEW-snapshot capture. A null ref means that layer fell back to
          // a text/error branch; we skip it and the destination's matching
          // named element crossfades via the root transition.
          if (!supportsViewTransitions()) return;
          if (e.button !== 0) return;
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
          if (!heroRef.current && !logoRef.current) return;
          e.preventDefault();
          const base = `steam-game-${game.appid}`;
          if (heroRef.current) heroRef.current.style.viewTransitionName = `${base}-hero`;
          if (logoRef.current) logoRef.current.style.viewTransitionName = `${base}-logo`;
          const doc = document as Document & {
            startViewTransition?: (cb: () => Promise<void>) => unknown;
          };
          doc.startViewTransition?.(async () => {
            if (heroRef.current) heroRef.current.style.viewTransitionName = "";
            if (logoRef.current) logoRef.current.style.viewTransitionName = "";
            await navigate({
              to: "/steam/game/$appid",
              params: { appid: String(game.appid) },
            });
          });
        }}
        className="block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SteamGameRowShell
          appid={game.appid}
          assetTimestamp={game.assetTimestamp}
          name={game.name}
          meta={
            <>
              {lifetime ? `${lifetime} lifetime` : "Never launched"}
              {twoWeeks ? ` · ${twoWeeks} last two weeks` : ""}
              {lastPlayed ? ` · last played ${lastPlayed}` : ""}
            </>
          }
          heroRef={heroRef}
          logoRef={logoRef}
        />
      </Link>
    </li>
  );
}
