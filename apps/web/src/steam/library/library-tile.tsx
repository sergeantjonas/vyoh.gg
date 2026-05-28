import { Sparkline } from "@/components/ui/sparkline";
import { useHoverPrefetch } from "@/lib/use-hover-prefetch";
import { cn } from "@/lib/utils";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import {
  makeHeroFallbackHandlers,
  steamCapsuleUrl,
  steamLibraryCapsuleUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { gameAchievementsQueryOptions } from "@/steam/game/use-game-achievements";
import { useActiveGame } from "@/steam/library/active-game-context";
import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { CSSProperties, Ref } from "react";
import { useRef, useState } from "react";
import {
  LIBRARY_HOVERCARD_CONTENT_CLASS,
  LibraryTileHovercardContent,
} from "./library-tile-hovercard";

export function LibraryTile({
  game,
  liRef,
  style,
  dataIndex,
  mountStagger,
}: {
  game: SteamOwnedGame;
  // Virtualizer-controlled `<li>` positioning — see LibraryRow for the
  // same prop contract. Plain callers leave these undefined; the tile
  // then lays out in the parent CSS grid.
  liRef?: Ref<HTMLLIElement>;
  style?: CSSProperties;
  dataIndex?: number;
  // See LibraryRow.mountStagger — same contract.
  mountStagger?: boolean;
}) {
  // Library art priority mirrors Steam's own client: prefer the dedicated
  // 600×900 portrait capsule, fall back to a synthetic composition of the
  // wide hero + logo overlay when the capsule is missing (common for
  // recently-released titles that haven't had the portrait asset uploaded
  // yet — Steam composes this at render time too).
  const [capsuleFailed, setCapsuleFailed] = useState(false);
  const [capsuleLoaded, setCapsuleLoaded] = useState(false);
  const navigate = useNavigate();
  const { saveListScroll, setActiveGame } = useActiveGame();
  const queryClient = useQueryClient();
  const prefetch = useHoverPrefetch(() => {
    queryClient.prefetchQuery(gameAchievementsQueryOptions(game.appid));
  });
  // Hidden hero-img layer is the morph anchor: the destination renders the
  // same hero asset as its foreground banner, so naming *just* this hidden
  // layer carries the visual continuity across a 2:3 → 3:1 aspect change
  // without forcing the visible primary art (the portrait capsule) to warp.
  // See docs/working-notes/cross-cutting/view-transitions-rollout.md.
  const morphLayerRef = useRef<HTMLImageElement>(null);

  const lifetime =
    game.playtimeForeverMinutes > 0 ? formatPlaytime(game.playtimeForeverMinutes) : null;

  // `view-transition-name` on the li lets sort/filter reorders inside
  // `withReorderViewTransition` pair OLD↔NEW positions per game. See
  // library-row.tsx for the full rationale; the `library-tile-` prefix
  // keeps the namespace disjoint from rows during a layout switch.
  const liStyle: CSSProperties = {
    ...style,
    viewTransitionName: `library-tile-${game.appid}`,
  };

  return (
    <li
      ref={liRef}
      style={liStyle}
      data-index={dataIndex}
      data-list-item-vt
      data-mount-stagger={mountStagger ? "" : undefined}
      className="library-tile group/tile"
    >
      <HoverCardPrimitive.Root openDelay={200} closeDelay={100}>
        <HoverCardPrimitive.Trigger asChild>
          <Link
            to="/steam/game/$appid"
            params={{ appid: String(game.appid) }}
            onMouseEnter={() =>
              prefetchSteamGameBackdrop(game.appid, game.assetTimestamp, game.flipHero)
            }
            onFocus={() =>
              prefetchSteamGameBackdrop(game.appid, game.assetTimestamp, game.flipHero)
            }
            onPointerEnter={prefetch.onPointerEnter}
            onPointerLeave={prefetch.onPointerLeave}
            onPointerDown={() => {
              // Mirrors LibraryRow: save scroll + flag the active game on
              // press so the detail page can restore both on back-nav. Even
              // though the tile layout skips the backward rect-morph, the
              // scroll restore still applies.
              prefetch.onPointerDown();
              saveListScroll();
              setActiveGame(game.appid);
            }}
            onClick={(e) => {
              // VT path: apply `view-transition-name` to the backdrop layer
              // via ref so it is present at OLD-snapshot capture (synchronous
              // with the startViewTransition call), then clear it inside the
              // callback BEFORE awaiting navigation so it isn't present at
              // NEW-snapshot capture (would collide with the destination
              // hero's matching name). Mirrors champion-table.tsx + match-row.
              if (!supportsViewTransitions()) return;
              if (e.button !== 0) return;
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
              const el = morphLayerRef.current;
              if (!el) return;
              e.preventDefault();
              // Drop every list-item VT name before snapshot capture so
              // non-clicked tiles fall into the root group's unified
              // crossfade. See LibraryRow's onClick for the rationale.
              for (const target of document.querySelectorAll<HTMLElement>(
                "[data-list-item-vt]"
              )) {
                target.style.viewTransitionName = "";
              }
              const name = `steam-game-${game.appid}-hero`;
              el.style.viewTransitionName = name;
              const doc = document as Document & {
                startViewTransition?: (cb: () => Promise<void>) => unknown;
              };
              doc.startViewTransition?.(async () => {
                if (morphLayerRef.current)
                  morphLayerRef.current.style.viewTransitionName = "";
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
            className="flex flex-col gap-5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* `perspective(...)` is applied ONLY in :hover — at rest the
                tile is a flat, single-layer element. The Safari composite
                pass on /steam/library previously merged ~20 permanently-
                promoted tile layers per frame (21-35ms Composite on
                profile→library nav); hover-gated promotion cuts that to
                whichever single tile the user is interacting with. The
                first-hover frame pays a one-shot layer promotion (~5-10ms
                on Safari) which is invisible against the gesture itself.
                `filter` dropped from the transition list so the brightness
                /saturate change snaps instead of interpolating — kept the
                cost of 20 tiles' transitionstart/transitionend storm out
                of the post-mount frame budget without changing the look. */}
            <div className="relative isolate aspect-2/3 origin-top overflow-hidden rounded-lg bg-muted shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] transition-[box-shadow,transform] duration-500 ease-out group-hover/tile:shadow-[0_24px_38px_-10px_rgba(0,0,0,0.7),0_12px_24px_-8px_rgba(255,255,255,0.15)] group-hover/tile:brightness-[1.1] group-hover/tile:saturate-[1.1] group-hover/tile:transform-[perspective(700px)_rotateX(7deg)_rotateY(-9deg)_scale(1.02)]">
              {/* Lowest layer: hidden hero img sits behind the primary
                  portrait capsule, invisible at rest because covered. It
                  exists so the view-transition morph has a named element
                  that shares its asset with the destination's foreground
                  hero — capsule-to-hero would warp the primary art, but
                  this hidden-mirror trick lets the portrait art crossfade
                  via the root transition while the named layer
                  interpolates rect from portrait-bbox to landscape-banner.
                  Chains hero → page-background on missing-hero titles so
                  the morph snapshot has real content to interpolate
                  (rather than an empty rect) on pre-2019 titles.
                  No `filter:` here — any blur/saturate forces this hidden
                  img onto its own composite layer permanently, and Safari
                  paid ~100ms compositing 20 such layers per library-mount
                  frame. The element gets its VT name applied in the click
                  handler, which promotes-on-demand for the morph snapshot
                  without paying the rest-state layer cost. */}
              <img
                ref={morphLayerRef}
                src={steamLibraryHeroUrl(game.appid, game.assetTimestamp, game.flipHero)}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                {...makeHeroFallbackHandlers({
                  appid: game.appid,
                  assetTimestamp: game.assetTimestamp,
                  onSuccess: () => {},
                  onMissing: () => {},
                })}
                className="absolute inset-0 size-full object-cover"
              />
              {capsuleFailed ? (
                <HeroFallback game={game} />
              ) : (
                <img
                  src={steamLibraryCapsuleUrl(game.appid, game.assetTimestamp)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setCapsuleLoaded(true)}
                  onError={() => setCapsuleFailed(true)}
                  style={{ opacity: capsuleLoaded ? 1 : 0 }}
                  className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-600 ease-out group-hover/tile:scale-110"
                />
              )}
              {/* Steam-style anchored sheen — gradient stays pinned at the
                  top-right corner (gradient direction 225° puts the bright stop
                  at the upper-right) and the transparent end-stop animates via
                  the registered --sheen-extent variable (see index.css). At
                  rest the falloff reaches 25% of the diagonal — a tight gloss
                  at the corner only. On hover it extends to 75%, growing
                  inward toward the middle without translating any hard edge
                  across the card. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.12)_calc(var(--sheen-extent)-6%),rgba(255,255,255,0)_var(--sheen-extent))] opacity-20 transition-[--sheen-extent,opacity] duration-900 ease-out [--sheen-extent:25%] group-hover/tile:opacity-100 group-hover/tile:[--sheen-extent:42%]"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium underline-offset-2 group-hover/tile:underline">
                {game.name}
              </span>
              <span className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                <span className="truncate">
                  {lifetime ? `${lifetime} lifetime` : "Never launched"}
                </span>
                {game.recentPlaytimeMinutes.length >= 5 &&
                  Math.max(...game.recentPlaytimeMinutes) > 0 && (
                    <Sparkline
                      data={game.recentPlaytimeMinutes}
                      width={36}
                      height={10}
                      className="shrink-0 text-foreground/60"
                      stroke="currentColor"
                      aria-label={`playtime trend, last ${game.recentPlaytimeMinutes.length} days`}
                    />
                  )}
              </span>
            </div>
          </Link>
        </HoverCardPrimitive.Trigger>
        <HoverCardPrimitive.Portal>
          <HoverCardPrimitive.Content
            side="right"
            align="start"
            sideOffset={16}
            collisionPadding={16}
            className={LIBRARY_HOVERCARD_CONTENT_CLASS}
          >
            <LibraryTileHovercardContent game={game} />
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      </HoverCardPrimitive.Root>
    </li>
  );
}

// Steam-client-style synthetic tile: hero (wide 1920×620, object-cover into
// the portrait box center-crops horizontally) + logo overlay near the bottom,
// with a gradient mask underneath for legibility. Falls through to a plain
// text overlay if the hero itself is unavailable (true artless titles like
// the older MW2 dedicated-launcher entries).
function HeroFallback({ game }: { game: SteamOwnedGame }) {
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // wsrv.nl forwards upstream 404s as `200 OK` with an empty body, so a
  // missing asset fires `onLoad` rather than `onError`. Promote the missing-
  // image case to the failed branch via `naturalWidth === 0` — required for
  // titles like CoD MW2 MP / MGSV GZ where the logo simply doesn't exist
  // and we want the text fallback to render in its place.
  const handleHeroLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setHeroFailed(true);
    else setHeroLoaded(true);
  };
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  if (heroFailed) {
    // Truly artless titles (e.g. Deus Ex: HR — predates the library_hero
    // spec) get a blurred header.jpg backdrop behind the wordmark. header.jpg
    // is the most universally-available Steam asset; if it's also missing,
    // the backdrop sits on `bg-muted` from the outer tile div.
    return (
      <>
        <img
          src={steamCapsuleUrl(game.appid, game.assetTimestamp)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full scale-110 object-cover blur-sm"
        />
        <div className="absolute inset-0 bg-card/50" />
        <div className="absolute inset-0 flex items-center justify-center p-3 text-center">
          <span className="line-clamp-4 text-sm font-medium text-white drop-shadow-lg">
            {game.name}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <img
        src={steamLibraryHeroUrl(game.appid, game.assetTimestamp, game.flipHero)}
        alt=""
        loading="lazy"
        onLoad={handleHeroLoad}
        onError={() => setHeroFailed(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out",
          heroLoaded ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-transparent" />
      {logoFailed ? (
        <span className="absolute right-3 bottom-3 left-3 line-clamp-2 text-sm font-bold text-white drop-shadow-lg">
          {game.name}
        </span>
      ) : (
        <img
          src={steamLibraryLogoUrl(game.appid, game.assetTimestamp)}
          alt={game.name}
          loading="lazy"
          onLoad={handleLogoLoad}
          onError={() => setLogoFailed(true)}
          className={cn(
            "absolute right-3 bottom-3 left-3 max-h-1/3 object-contain object-bottom drop-shadow-lg transition-opacity duration-500 ease-out",
            logoLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </>
  );
}
