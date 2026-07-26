import { CvSection } from "@/_shared/cv-section";
import { SlidePanel } from "@/_shared/slide-panel";
import { routeMeta } from "@/lib/route-meta";
import { toastError, toastSuccess } from "@/lib/toast";
import { useThemeColor } from "@/lib/use-theme-color";
import { CreditsLine } from "@/steam/_shared/credits-line";
import { DeckCompatChip } from "@/steam/_shared/deck-compat-chip";
import { GameRatingBadge } from "@/steam/_shared/game-rating-badge";
import { PlatformIconRow } from "@/steam/_shared/platform-icon-row";
import { PlaytimePill } from "@/steam/_shared/playtime-pill";
import { ReviewSummaryChip } from "@/steam/_shared/review-summary-chip";
import { steamPageBackgroundUrl } from "@/steam/_shared/steam-image";
import { AchievementPanel } from "@/steam/game/achievement-panel";
import { CompletionVerdictCard } from "@/steam/game/completion-verdict-card";
import { GameAboutBlock } from "@/steam/game/game-about-block";
import { GameDetailSkeleton } from "@/steam/game/game-detail-skeleton";
import { GamePanelHero } from "@/steam/game/game-panel-hero";
import { GameScreenshotStrip } from "@/steam/game/game-screenshot-strip";
import { GameUnlockTimeline } from "@/steam/game/game-unlock-timeline";
import { LastProgressedCard } from "@/steam/game/last-progressed-card";
import { RarestUnlockCard } from "@/steam/game/rarest-unlock-card";
import { RaritySignatureCard } from "@/steam/game/rarity-signature-card";
import { TimeTo100Card } from "@/steam/game/time-to-100-card";
import { useActiveGame } from "@/steam/library/active-game-context";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SteamGameSearch {
  ach?: string | undefined;
}

// API origin for the per-route OG image endpoint. Now imported rather than
// re-declared: `lib/api-url` has no imports of its own, so head() keeps the
// leaf dependency graph the local copy was protecting. The public base is the
// right one here — a crawler resolves og:image from outside the box.
import { API_PUBLIC_URL } from "@/lib/api-url";

export const Route = createFileRoute("/steam/library/$appid")({
  component: SteamGamePanel,
  validateSearch: (search: Record<string, unknown>): SteamGameSearch => ({
    ach: typeof search.ach === "string" ? search.ach : undefined,
  }),
  // Static fallback used until `SteamGamePanel` enriches `document.title`
  // with the resolved game name (see `useEffect` below). Crawlers that
  // never run the component still get a non-numeric title.
  head: ({ params }) =>
    routeMeta({
      title: "Steam · vyoh.gg",
      description: `Steam game detail (appid ${params.appid}) on vyoh.gg`,
      ogImage: `${API_PUBLIC_URL}/og/steam-game/${params.appid}.png`,
      ogType: "article",
    }),
});

function SteamGamePanel() {
  const { appid: appidParam } = Route.useParams();
  const { ach } = Route.useSearch();
  const appid = Number.parseInt(appidParam, 10);
  const { data, isPending, isError } = useSteamOwnedGames();
  const navigate = useNavigate();
  const { activeGame, setActiveGame } = useActiveGame();

  const game = data?.games.find((g) => g.appid === appid);

  // Captured at first paint — if `activeGame === appid` at mount, the user
  // clicked this row from the list (handler set it pre-navigate). Cold
  // deep-link / refresh skips the slide so the panel just appears (per arc:
  // "the panel just *is*, in its open state").
  const skipSlideInRef = useRef(activeGame !== appid);

  // Cold arrival: write activeGame from the URL so library's list scroll
  // restore + settle dim can fire on back-nav. Idempotent — re-renders bail
  // when activeGame already matches.
  useEffect(() => {
    if (activeGame !== appid) setActiveGame(appid);
  }, [activeGame, appid, setActiveGame]);

  // Page-backdrop claim intentionally NOT made from the panel — same fix
  // pattern as $championKey.tsx + $matchId.tsx. Swapping the page backdrop
  // for the duration of the panel triggers a backdrop transition (the
  // SteamProfileBackdrop's crossfade) that adds compositor work during the
  // panel's open/close. The panel's own hero image inside the panel chrome
  // already shows the game art — the page backdrop changing on top of that
  // is redundant. Trade: the page background stays on the animated profile
  // background while the panel is open, instead of swapping to the game's
  // baked-in art. The theme-color cascade still follows the game's dominant
  // hue via `useThemeColor` directly, save/restoring on unmount so the
  // parent claim returns cleanly.
  useThemeColor(game?.dominantHex ?? undefined);

  // Tab title enrichment. The route's `head()` runs before the library
  // query resolves, so it ships the static "Steam · vyoh.gg" fallback;
  // once `useSteamOwnedGames` lands the game name we swap to it. No
  // restore-on-unmount — TanStack Router fires the next route's head()
  // on navigation, which overwrites the title naturally.
  useEffect(() => {
    if (game?.name) {
      document.title = `${game.name} · vyoh.gg`;
    }
  }, [game?.name]);

  // `logoFailed` is owned at the panel level because both the hero block
  // (h2 fallback over the banner) and the Identity card below (h1 fallback
  // game name) need to react to it. Other hero/logo load-state lives
  // inside `GamePanelHero` — purely display-internal.
  const [logoFailed, setLogoFailed] = useState(false);

  // Reuse the game's page-background image as the panel chrome backdrop
  // so the panel carries the same atmospheric energy as the page-level
  // background behind it — no live `backdrop-filter`, the image is baked
  // into the panel's static background by SlidePanel. Resolves null while
  // the library snapshot is still loading; chrome stays on flat bg-card
  // until then.
  const chromeBackdropUrl = game
    ? steamPageBackgroundUrl(appid, game.assetTimestamp, game.flipHero)
    : null;

  const panelTitle = game?.name ?? `App ${appidParam}`;

  const handleShare = () => {
    const url = window.location.href;
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      toastError("Clipboard isn't available in this browser");
      return;
    }
    clipboard
      .writeText(url)
      .then(() => toastSuccess("Link copied to clipboard"))
      .catch(() => toastError("Couldn't copy link"));
  };

  const handleClose = () => {
    navigate({ to: "/steam/library" });
  };

  return (
    <SlidePanel
      open
      onClose={handleClose}
      title={panelTitle}
      skipSlideIn={skipSlideInRef.current}
      chromeBackdropUrl={chromeBackdropUrl}
      header={
        <>
          {/* Game name fills the header where LoL panels render their sub-tab
              strip. Without it the header reads as empty chrome — the hero
              banner inside the panel body still owns the wordmark, but the
              sticky header has space to do useful work as the user scrolls
              past the hero. truncate keeps long titles inside the flex track
              when the share button slot is otherwise narrow. DialogPrimitive.
              Title in SlidePanel still owns the accessible dialog name. */}
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {panelTitle}
          </span>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Copy link to this game"
            className="cursor-pointer rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Share2 className="size-4" />
          </button>
        </>
      }
    >
      {/* Body is grouped into three bands. The first ("Identity") collapses the
          hero, the facts strip, and the editorial blurb into one tight visual
          unit — chips sit right under the hero (`gap-3`) so they read as part of
          the hero band rather than a floating new section, and playtime is folded
          into the facts strip as small pills rather than rendered as a separate
          card (the older card layout had a short box floating next to a tall
          description column). The next two bands (Editorial, Progress) keep the
          larger between-band gap so the eye can land on group boundaries.
          NO opacity wrapper here: any opacity < 1 on an ancestor creates a
          group-opacity stacking context and flattens descendants into a single
          raster buffer, which kills every descendant `backdrop-filter` until
          the opacity reaches 1 — the "frosted pop" trap from earlier rounds. */}
      <div className="flex flex-col gap-10 p-4">
        {/* Hero banner — Steam's library_hero.jpg (1920×620) with logo.png
            overlay positioned bottom-left, mirroring Steam's own library
            page aesthetic. Self-contained component owning hero+logo load
            state, the row→panel FLIP morph, and the view-transition-name
            wiring. See `game-panel-hero.tsx` for the morph mechanics. */}
        <GamePanelHero
          appid={appid}
          appidParam={appidParam}
          game={game}
          logoFailed={logoFailed}
          setLogoFailed={setLogoFailed}
        />

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
            they're separated by a wide media block.

            GameAboutBlock is the first frosted tile in the panel and sits
            below the screenshot strip — typically below-fold on panel open
            unless the viewport is very tall. CvSection gates its frosted
            layer-promotion to scroll-near (same pattern as the LoL
            champion-detail panel — chunk 2). */}
        {game && (
          <section className="flex flex-col gap-4">
            <GameScreenshotStrip appid={appid} trailers={game?.trailers ?? null} />
            <CvSection minHeight={250}>
              <GameAboutBlock appid={appid} frosted />
            </CvSection>
          </section>
        )}

        {/* Band 3 — Progress. Unlock timeline → 5-card verdict grid →
            per-achievement panel, in narrative order ("when did it happen"
            → "how complete is it" → "what's left"). Tight inner gap so the
            three card layers read as one progress story. Every tile here
            sits directly over the panel chrome's baked backdrop, so they
            all opt into the frosted recipe (one level of glass — see
            repo-conventions.md § Tile background). All three blocks are
            below-fold on panel open and wrapped in CvSection so their
            `backdrop-filter` layer-promotion is gated to scroll-near. */}
        {game && (
          <section className="flex flex-col gap-4">
            <CvSection minHeight={220}>
              <GameUnlockTimeline appid={appid} frosted />
            </CvSection>
            <CvSection minHeight={420}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <CompletionVerdictCard appid={appid} frosted />
                <TimeTo100Card appid={appid} frosted />
                <LastProgressedCard appid={appid} frosted />
                <RaritySignatureCard appid={appid} frosted />
                <RarestUnlockCard appid={appid} frosted />
              </div>
            </CvSection>
            <CvSection minHeight={500}>
              <AchievementPanel appid={appid} highlightTarget={ach} frosted />
            </CvSection>
          </section>
        )}
      </div>
    </SlidePanel>
  );
}
