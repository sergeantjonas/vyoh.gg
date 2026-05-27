import { useMediaQuery } from "@/lib/use-media-query";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { SteamGameRowShell } from "@/steam/_shared/steam-game-row";
import type { GameOrigin } from "@/steam/library/active-game-context";
import { useActiveGame } from "@/steam/library/active-game-context";
import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
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
  style,
  dataIndex,
  mountStagger,
}: {
  game: SteamOwnedGame;
  // Virtualizer-controlled `<li>` positioning. When the row is rendered
  // inside a virtualized list, the parent assigns absolute style +
  // data-index so TanStack can place the row at the right y offset.
  // The list deliberately does NOT pass a measureElement ref — rows are
  // a fixed-size shell, so the static estimate is correct and dynamic
  // measurement just causes scroll-restore drift (see library-list-virtual).
  style?: CSSProperties;
  dataIndex?: number;
  // First-paint cascade opt-in. Parent stamps this on the first ~8 items
  // of the initial mount and merges --i into `style`; the data-attribute
  // triggers the `[data-mount-stagger]` rule in motion.css. Scrolled-in
  // rows mount with mountStagger=undefined and don't replay the animation.
  mountStagger?: boolean;
}) {
  const navigate = useNavigate();
  const { saveListScroll, setActiveGame, originRectRef, setOriginRect } = useActiveGame();
  const reduced = useReducedMotion();
  const showHovercard = useMediaQuery(HOVERCARD_VIEWPORT_QUERY);
  // Two-element morph: hero img + logo img each carry a unique
  // view-transition-name on click, pairing with matching names on the
  // destination game page. Both refs can be null when their img has
  // fallen back to a text/error branch — null-checked below; that layer
  // then simply crossfades via the root transition.
  const heroRef = useRef<HTMLImageElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const liRef = useRef<HTMLLIElement>(null);
  // Captured once on mount so StrictMode's double-invocation doesn't lose
  // the origin after the first run clears originRectRef. Mirrors
  // match-row's pattern.
  const savedOrigin = useRef<GameOrigin | null>(null);

  // Return animation: when this row is the destination of a back-nav from
  // /steam/game/$appid, animate the hero (and logo, when present) from the
  // captured detail-page rect to their natural row position. Mirrors
  // match-row's mount-only effect but runs two independent `el.animate()`
  // calls so the logo can morph from its own bottom-left detail-page
  // anchor rather than scaling with the hero. Tile layout skips this
  // entirely: the breadcrumb only writes an origin rect when layout is
  // "rows", so originRectRef is null in tile-layout back-navs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (o?.appid !== game.appid || o.direction !== "backward") return;
      savedOrigin.current = o;
    }
    const origin = savedOrigin.current;
    if (!origin) return;
    if (reduced) return;
    const heroEl = heroRef.current;
    const logoEl = logoRef.current;
    const liEl = liRef.current;
    if (!heroEl) return;
    // Morph the WHOLE row chrome (the `h-36 / sm:h-40` div) rather than
    // just the hero img. Earlier iterations transformed the hero only and
    // left the chrome's gradient/sheen/logo/meta siblings in place at the
    // natural row slot — the user saw the hero img sliding past the
    // stationary left-side legibility gradient ("the card is moving
    // behind a darkening layer"), and once the hero flew away the row
    // slot showed `bg-card` + gradient with no image behind it ("exposing
    // a black background"). Morphing the chrome as one piece carries
    // every overlay along with it, so there is no static gradient for the
    // hero to slide under and no empty row slot.
    const chromeEl = heroEl.parentElement;
    if (!chromeEl) return;
    // Lift the active LI's z-index so the morphing chrome paints above
    // any neighbouring rows it overlaps in flight.
    if (liEl) liEl.style.zIndex = "50";
    // Force opacity:1 inline on the hero img so the morph has visible
    // content. Tailwind defaults the img to `opacity-0` until `onLoad`
    // flips `heroLoaded`, which can land 1–3 frames after mount even on
    // a cache hit — without this override the chrome morphs around an
    // invisible image for the first frames.
    heroEl.style.opacity = "1";
    if (logoEl) logoEl.style.opacity = "1";
    // Consume the origin synchronously so a re-render of this row (e.g.
    // a virtualizer remount) doesn't try to start a second morph.
    setOriginRect(null);
    // Measure the chrome's natural rect. The origin captured from the
    // detail page's hero wrapper rect is the "where it came from" anchor;
    // the chrome's live rect is "where it's landing." FLIP delta between
    // those drives a single transform on the chrome — everything inside
    // (hero, gradient, logo, meta) travels along.
    const chromeLive = chromeEl.getBoundingClientRect();
    const dx = origin.heroRect.left - chromeLive.left;
    const dy = origin.heroRect.top - chromeLive.top;
    const sx = origin.heroRect.width / chromeLive.width;
    const sy = origin.heroRect.height / chromeLive.height;
    const anim = chromeEl.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
          transformOrigin: "0 0",
        },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
    );
    const restore = () => {
      if (liEl) liEl.style.zIndex = "";
    };
    anim.onfinish = restore;
    return () => {
      anim.cancel();
      restore();
      heroEl.style.opacity = "";
      if (logoEl) logoEl.style.opacity = "";
    };
  }, []);

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
      onMouseEnter={() =>
        prefetchSteamGameBackdrop(game.appid, game.assetTimestamp, game.flipHero)
      }
      onFocus={() =>
        prefetchSteamGameBackdrop(game.appid, game.assetTimestamp, game.flipHero)
      }
      onPointerDown={() => {
        // Save list scroll + flag the active game on press so the
        // detail page can later restore both on back-navigation. Mirrors
        // match-row's pattern: pointerdown fires before the navigation
        // resolves, and the active marker carries through forward + back.
        saveListScroll();
        setActiveGame(game.appid);
      }}
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
        // Strip every list-item's `view-transition-name` before snapshot
        // capture. The row/tile `li`s carry per-game names (used by
        // `withReorderViewTransition` for in-place sort/filter morphs);
        // on a NAV transition those names exist only in OLD, so each row
        // would get its own independent `::view-transition-old(...)`
        // fade-out — reading as a flicker of "remnant cards" against the
        // root crossfade. Clearing them collapses every non-clicked row
        // into the root group's single unified fade.
        for (const el of document.querySelectorAll<HTMLElement>("[data-list-item-vt]")) {
          el.style.viewTransitionName = "";
        }
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
        subjectXPercent={game.subjectXPercent}
        subjectYPercent={game.subjectYPercent}
        flipHero={game.flipHero}
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
      <li
        ref={liRef}
        style={liStyle}
        data-index={dataIndex}
        data-list-item-vt
        data-mount-stagger={mountStagger ? "" : undefined}
      >
        {link}
      </li>
    );

  return (
    <li
      ref={liRef}
      style={liStyle}
      data-index={dataIndex}
      data-list-item-vt
      data-mount-stagger={mountStagger ? "" : undefined}
    >
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
