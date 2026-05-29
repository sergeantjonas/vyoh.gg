import { useThemeColor } from "@/lib/use-theme-color";
import { cn } from "@/lib/utils";
import { CreditsLine } from "@/steam/_shared/credits-line";
import { DeckCompatChip } from "@/steam/_shared/deck-compat-chip";
import { GameRatingBadge } from "@/steam/_shared/game-rating-badge";
import { PlatformIconRow } from "@/steam/_shared/platform-icon-row";
import { PlaytimePill } from "@/steam/_shared/playtime-pill";
import { ReviewSummaryChip } from "@/steam/_shared/review-summary-chip";
import {
  makeHeroFallbackHandlers,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { AchievementPanel } from "@/steam/game/achievement-panel";
import { CompletionVerdictCard } from "@/steam/game/completion-verdict-card";
import { GameAboutBlock } from "@/steam/game/game-about-block";
import { GameDetailSkeleton } from "@/steam/game/game-detail-skeleton";
import { GameHeroTrailerPill } from "@/steam/game/game-hero-trailer-pill";
import { GameScreenshotStrip } from "@/steam/game/game-screenshot-strip";
import { GameUnlockTimeline } from "@/steam/game/game-unlock-timeline";
import { LastProgressedCard } from "@/steam/game/last-progressed-card";
import { RarestUnlockCard } from "@/steam/game/rarest-unlock-card";
import { RaritySignatureCard } from "@/steam/game/rarity-signature-card";
import { TimeTo100Card } from "@/steam/game/time-to-100-card";
import { GameBreadcrumb } from "@/steam/library/game-breadcrumb";
import { useSteamGameBackdrop } from "@/steam/profile-backdrop";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { createFileRoute } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import { useState } from "react";

interface SteamGameSearch {
  ach?: string | undefined;
}

export const Route = createFileRoute("/steam/game/$appid")({
  component: SteamGamePage,
  validateSearch: (search: Record<string, unknown>): SteamGameSearch => ({
    ach: typeof search.ach === "string" ? search.ach : undefined,
  }),
});

function SteamGamePage() {
  const { appid: appidParam } = Route.useParams();
  const { ach } = Route.useSearch();
  const appid = Number.parseInt(appidParam, 10);
  const { data, isPending, isError } = useSteamOwnedGames();

  const game = data?.games.find((g) => g.appid === appid);

  // Swap the page backdrop to this game's art while the user is on the
  // detail page; cleared on unmount so we fade back to the profile backdrop.
  // Claim by appid as soon as we have it — the page-background URL only
  // needs the appid (+ `assetTimestamp` as cache-buster, when enrichment has
  // run) and we want the fade to start before the library snapshot resolves.
  useSteamGameBackdrop({
    appid,
    assetTimestamp: game?.assetTimestamp ?? null,
    flipHero: game?.flipHero ?? false,
  });
  useThemeColor(game?.dominantHex ?? undefined);

  // Not every Steam game ships `library_hero.jpg` / `logo.png` — these are
  // part of the newer library-presentation asset set, missing on plenty of
  // older or indie titles. wsrv.nl forwards the upstream 404 to the browser
  // and we catch it via `onError` to swap to a graceful fallback (blurred
  // header.jpg backdrop for the hero, the heading text for the logo).
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Hero img uses the shared hero → page-background fallback chain
  // (`steamLibraryHeroUrl` → `steamPageBackgroundUrl` → setHeroFailed).
  // About 9% of a typical library lacks `library_hero.jpg` (pre-2019
  // titles); the page-background fallback recovers most of those with
  // logo-free scenic art.
  const heroHandlers = makeHeroFallbackHandlers({
    appid,
    assetTimestamp: game?.assetTimestamp ?? null,
    onSuccess: () => setHeroLoaded(true),
    onMissing: () => setHeroFailed(true),
  });
  // wsrv.nl forwards upstream 404s as `200 OK` with empty bytes, so a
  // missing logo fires `onLoad` instead of `onError`. Promote zero-width
  // loads to the failed branch so the text fallback actually renders.
  // (Logo has no page-bg fallback — older titles never had a wordmark
  // image at all, so we go straight to the text branch.)
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  // Page is grouped into three bands. The first ("Identity") collapses the
  // hero, the facts strip, and the editorial blurb into one tight visual
  // unit — chips sit right under the hero (`gap-3`) so they read as part of
  // the hero band rather than a floating new section, and playtime is folded
  // into the facts strip as small pills rather than rendered as a separate
  // card (the older card layout had a short box floating next to a tall
  // description column). The next two bands (Editorial, Progress) keep the
  // larger between-band gap so the eye can land on group boundaries.
  return (
    <div className="flex flex-col gap-10">
      <GameBreadcrumb appid={appid} gameName={game?.name ?? `App ${appidParam}`} />

      {/* Hero banner — Steam's library_hero.jpg (1920×620) with logo.png
          overlay positioned bottom-left, mirroring Steam's own library page
          aesthetic. Aspect ratio is locked so the layout is stable before
          the image loads. For the rare older titles that never shipped a
          library_hero asset, the `heroFailed` branch leaves the
          gradient-on-bg-muted backdrop visible (no jarring black box). */}
      {/* `view-transition-name` lives on this wrapper rather than the
          `<img>` so the snapshot captures both the hero and the dark
          gradient layered over it. With the name on the img alone, the
          gradient was rendered into the root group only — it appeared
          AFTER the morph completed and the live DOM became visible,
          which read as the banner suddenly darkening at the end of the
          animation. Naming the wrapper folds the gradient into the same
          snapshot pair, so the darkening crossfades in throughout the
          morph instead of snapping on. */}
      <div
        data-steam-game-hero={appid}
        style={{ viewTransitionName: `steam-game-${appid}-hero` }}
        className="relative aspect-1920/620 w-full overflow-hidden rounded-lg border bg-linear-to-br from-muted via-card to-muted"
      >
        {/* Two view-transition morph anchors. From the library TILE: only
            the hero name pairs (tile renders a hidden hero img as its
            anchor); the logo name has no source pair and crossfades.
            From the library ROW: both hero and logo pair, producing a
            coordinated two-element morph — hero rect tweens from the row's
            right-pane into the full-width banner (the row's mask-image
            fade dissolves as it expands), and the logo wordmark locks as
            a landmark across the route swap. See
            docs/working-notes/cross-cutting/view-transitions-rollout.md. */}
        {!heroFailed && (
          <img
            src={steamLibraryHeroUrl(appid, game?.assetTimestamp, game?.flipHero)}
            alt=""
            loading="eager"
            onLoad={heroHandlers.onLoad}
            onError={heroHandlers.onError}
            className={cn(
              // Flip is baked into the URL — see `steamLibraryHeroUrl`.
              // CSS-only `transform: scaleX(-1)` survives in the static
              // DOM but is stripped from the view-transition snapshot
              // pixels, so the morph from library row would animate
              // between un-flipped frames and snap to the flipped DOM at
              // the end. URL-baked flip keeps both snapshots flipped
              // through the entire morph.
              "absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out",
              heroLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
        {logoFailed ? (
          <h2 className="absolute bottom-4 left-4 max-w-[55%] text-xl font-bold text-white drop-shadow-lg sm:bottom-6 sm:left-6 sm:text-2xl">
            {game?.name ?? `App ${appidParam}`}
          </h2>
        ) : (
          <img
            src={steamLibraryLogoUrl(appid, game?.assetTimestamp)}
            alt={game?.name ?? `App ${appidParam}`}
            loading="eager"
            onLoad={handleLogoLoad}
            onError={() => setLogoFailed(true)}
            data-steam-game-logo={appid}
            style={{ viewTransitionName: `steam-game-${appid}-logo` }}
            className={cn(
              "absolute bottom-4 left-4 h-1/3 max-w-[55%] object-contain object-bottom-left drop-shadow-lg transition-opacity duration-500 ease-out sm:bottom-6 sm:left-6",
              logoLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}
        {/* Quick-preview microtrailer pill. Self-gating on microtrailerWebm.
            The full-trailer modal (with audio + adaptive streaming + native
            controls) is reached separately, via trailer thumbnails in the
            screenshot carousel below the hero — see GameScreenshotStrip.
            Anchored to the hero wrapper (which carries the VT name) so the
            pill participates in the same view-transition snapshot as the
            hero img. */}
        {game && (
          <GameHeroTrailerPill
            microtrailerWebm={game.microtrailerWebm}
            microtrailerMp4={game.microtrailerMp4}
            microtrailerPoster={game.microtrailerPoster}
            microtrailerName={game.microtrailerName}
          />
        )}
      </div>

      {/* Band 1 — Identity card. The hero banner already carries the
          wordmark, so the duplicate h1 only renders when the logo asset
          failed (older titles missing `library_logo.png`). Card chrome
          matches the sibling sections on the page (verdict cards, unlock
          timeline, achievement panel) so the identity content reads as a
          discrete block instead of floating text. Playtime is rendered as
          inline pills in the chip row — no separate playtime card competes
          for vertical space. The full BBCode "About this game" body is
          folded into the same card behind a "Read full description" toggle
          (default collapsed) so the short description handles the
          one-glance case and the long form is one click away. */}
      {isPending ? (
        <GameDetailSkeleton />
      ) : (
        <section className="-mt-2 flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
          {logoFailed && (
            <h1 className="text-2xl font-bold tracking-tight">
              {game?.name ?? `App ${appidParam}`}
            </h1>
          )}
          {game && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <DeckCompatChip tier={game.steamDeckCompat} size="md" />
              <ReviewSummaryChip summary={game.reviewSummary} />
              <GameRatingBadge rating={game.gameRating} />
              <PlatformIconRow
                windows={game.platformWindows}
                mac={game.platformMac}
                linux={game.platformLinux}
                vr={game.platformVr}
              />
              <span className="mx-1 hidden h-5 w-px bg-border/60 sm:inline-block" />
              <PlaytimePill
                label="Total"
                value={
                  game.playtimeForeverMinutes > 0
                    ? formatPlaytime(game.playtimeForeverMinutes)
                    : "Never launched"
                }
                tone={game.playtimeForeverMinutes > 0 ? "active" : "muted"}
              />
              <PlaytimePill
                label="Recent"
                value={
                  game.playtime2WeeksMinutes !== null && game.playtime2WeeksMinutes > 0
                    ? formatPlaytime(game.playtime2WeeksMinutes)
                    : "—"
                }
                tone={
                  game.playtime2WeeksMinutes && game.playtime2WeeksMinutes > 0
                    ? "active"
                    : "muted"
                }
              />
            </div>
          )}
          {game && (
            <CreditsLine
              developers={game.developerNames}
              publishers={game.publisherNames}
              franchises={game.franchiseNames}
            />
          )}
          {/* Short description as the identity card's summary. The full
              "About this game" body lives in its own card lower on the
              page (band 2), physically separated by the screenshot strip
              so any content overlap between the two doesn't read as
              visually adjacent duplication. */}
          <p className="text-sm text-muted-foreground">
            {game?.shortDescription ??
              "Lifetime + recent playtime from the daily poller, with per-game achievement state where Steam exposes it."}
          </p>
        </section>
      )}

      {isError && (
        <p className="text-sm text-destructive">Playtime is unavailable right now.</p>
      )}

      {data && !game && (
        <p className="text-sm text-muted-foreground">
          App {appidParam} isn't in the current library snapshot. It may be unowned,
          refunded, or hidden from the public profile.
        </p>
      )}

      {/* Band 2 — Editorial. Screenshots + the full "About this game" body
          live here together. Screenshots come first so the strip acts as
          the visual interlude between the identity card's short summary
          and the longer prose — the eye doesn't pattern-match the
          inevitable content overlap between the two descriptions when
          they're separated by a wide media block. */}
      {game && (
        <section className="flex flex-col gap-4">
          <GameScreenshotStrip appid={appid} trailers={game?.trailers ?? null} />
          <GameAboutBlock appid={appid} />
        </section>
      )}

      {/* Band 3 — Progress. Unlock timeline → 5-card verdict grid →
          per-achievement panel, in narrative order ("when did it happen"
          → "how complete is it" → "what's left"). Tight inner gap so the
          three card layers read as one progress story. */}
      {game && (
        <section className="flex flex-col gap-4">
          <GameUnlockTimeline appid={appid} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CompletionVerdictCard appid={appid} />
            <TimeTo100Card appid={appid} />
            <LastProgressedCard appid={appid} />
            <RaritySignatureCard appid={appid} />
            <RarestUnlockCard appid={appid} />
          </div>
          <AchievementPanel appid={appid} highlightTarget={ach} />
        </section>
      )}
    </div>
  );
}
