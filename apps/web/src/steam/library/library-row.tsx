import { useMediaQuery } from "@/lib/use-media-query";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { DeckCompatChip } from "@/steam/_shared/deck-compat-chip";
import { SteamGameRowShell } from "@/steam/_shared/steam-game-row";
import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { CSSProperties, Ref } from "react";
import { useRef } from "react";
import {
  LIBRARY_HOVERCARD_CONTENT_CLASS,
  LibraryTileHovercardContent,
} from "./library-tile-hovercard";

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

// Hovercard only renders when there's room outside the max-w-4xl container
// for the popout to land in the side gutter without overflow. Below this
// threshold the row is the full visible width and side-placed popovers
// can't fit; rather than fall back to top/bottom (the row's wide footprint
// makes vertical placement read as a disconnected island), suppress the
// hovercard entirely — the row already exposes hero, logo, lifetime, and
// last-played inline; only the screenshot rotation is lost.
const HOVERCARD_VIEWPORT_QUERY = "(min-width: 1536px)";

export function LibraryRow({
  game,
  liRef,
  style,
  dataIndex,
}: {
  game: SteamOwnedGame;
  // Virtualizer-controlled `<li>` positioning. When the row is rendered
  // inside a virtualized list, the parent assigns ref + absolute style +
  // data-index so TanStack can measure the row and place it at the right
  // y offset. Plain (non-virtualized) callers leave these undefined and
  // the row lays out in normal flow.
  liRef?: Ref<HTMLLIElement>;
  style?: CSSProperties;
  dataIndex?: number;
}) {
  const navigate = useNavigate();
  const showHovercard = useMediaQuery(HOVERCARD_VIEWPORT_QUERY);
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

  const link = (
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
          // Opt out of router-level `defaultViewTransition` (main.tsx) —
          // this click already drives its own startViewTransition for the
          // per-element morph. Nesting the two collides the snapshot
          // pairs and breaks the forward morph.
          await navigate({
            to: "/steam/game/$appid",
            params: { appid: String(game.appid) },
            viewTransition: false,
          });
        });
      }}
      className="group/row block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
        trailing={<DeckCompatChip tier={game.steamDeckCompat} />}
      />
    </Link>
  );

  // `view-transition-name` on the li lets sort/filter reorders inside
  // `withReorderViewTransition` pair OLD↔NEW positions per game. Always-on
  // is intentional: at click-time the per-element hero/logo names (set on
  // the imgs inside) get carved out into their own VT groups, while this
  // outer name has no pair on the destination and falls back to the UA's
  // default exit fade — visually equivalent to today, since the surrounding
  // root group is also fading. `library-row-` prefix keeps the namespace
  // disjoint from `library-tile-` when the layout toggle switches in place.
  const liStyle: CSSProperties = {
    ...style,
    viewTransitionName: `library-row-${game.appid}`,
  };

  if (!showHovercard)
    return (
      <li ref={liRef} style={liStyle} data-index={dataIndex}>
        {link}
      </li>
    );

  return (
    <li ref={liRef} style={liStyle} data-index={dataIndex}>
      <HoverCardPrimitive.Root openDelay={250} closeDelay={120}>
        <HoverCardPrimitive.Trigger asChild>{link}</HoverCardPrimitive.Trigger>
        <HoverCardPrimitive.Portal>
          <HoverCardPrimitive.Content
            side="right"
            align="start"
            sideOffset={16}
            collisionPadding={16}
            className={LIBRARY_HOVERCARD_CONTENT_CLASS}
          >
            <LibraryTileHovercardContent game={game} variant="row" />
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      </HoverCardPrimitive.Root>
    </li>
  );
}
