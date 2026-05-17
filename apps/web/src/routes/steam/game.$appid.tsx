import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import {
  steamCapsuleUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
} from "@/steam/_shared/steam-image";
import { AchievementPanel } from "@/steam/game/achievement-panel";
import { CompletionVerdictCard } from "@/steam/game/completion-verdict-card";
import { GameScreenshotStrip } from "@/steam/game/game-screenshot-strip";
import { GameUnlockTimeline } from "@/steam/game/game-unlock-timeline";
import { LastProgressedCard } from "@/steam/game/last-progressed-card";
import { RarestUnlockCard } from "@/steam/game/rarest-unlock-card";
import { RaritySignatureCard } from "@/steam/game/rarity-signature-card";
import { TimeTo100Card } from "@/steam/game/time-to-100-card";
import { useSteamGameBackdrop } from "@/steam/profile-backdrop";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { Link, createFileRoute } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import { useState } from "react";

interface SteamGameSearch {
  ach?: string;
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
  });

  // Not every Steam game ships `library_hero.jpg` / `logo.png` — these are
  // part of the newer library-presentation asset set, missing on plenty of
  // older or indie titles. wsrv.nl forwards the upstream 404 to the browser
  // and we catch it via `onError` to swap to a graceful fallback (blurred
  // header.jpg backdrop for the hero, the heading text for the logo).
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // wsrv.nl forwards upstream 404s as `200 OK` with empty bytes, so a missing
  // asset fires `onLoad` instead of `onError`. Promote zero-width loads to
  // the failed branch so the text fallback actually renders.
  const handleHeroLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setHeroFailed(true);
    else setHeroLoaded(true);
  };
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setLogoFailed(true);
    else setLogoLoaded(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/steam/library">Library</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{game?.name ?? `App ${appidParam}`}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero banner — Steam's library_hero.jpg (1920×620) with logo.png
          overlay positioned bottom-left, mirroring Steam's own library page
          aesthetic. Aspect ratio is locked so the layout is stable before
          the image loads. A blurred + scaled header.jpg sits underneath as
          both the loading placeholder (no jarring dark block while the hero
          streams in) and the permanent fallback for older titles that never
          shipped a library_hero asset. */}
      <div className="relative aspect-1920/620 w-full overflow-hidden rounded-lg border bg-muted">
        <img
          src={steamCapsuleUrl(appid, game?.assetTimestamp)}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover blur-sm"
        />
        {!heroFailed && (
          <img
            src={steamLibraryHeroUrl(appid, game?.assetTimestamp)}
            alt=""
            loading="eager"
            onLoad={handleHeroLoad}
            onError={() => setHeroFailed(true)}
            className={cn(
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
            className={cn(
              "absolute bottom-4 left-4 h-1/3 max-w-[55%] object-contain object-bottom-left drop-shadow-lg transition-opacity duration-500 ease-out sm:bottom-6 sm:left-6",
              logoLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <div className="h-7 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {game?.name ?? `App ${appidParam}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Lifetime + recent playtime from the daily poller, with per-game achievement
            state where Steam exposes it.
          </p>
        </div>
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

      {isPending && (
        <div className="flex flex-col gap-2 rounded-lg border bg-card/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-10 animate-pulse rounded bg-muted" />
          </div>
        </div>
      )}

      {game && (
        <dl className="flex flex-col gap-1 rounded-lg border bg-card/50 p-4 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Lifetime</dt>
            <dd className="font-medium tabular-nums">
              {game.playtimeForeverMinutes > 0
                ? formatPlaytime(game.playtimeForeverMinutes)
                : "Never launched"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Last two weeks</dt>
            <dd className="font-medium tabular-nums">
              {game.playtime2WeeksMinutes !== null && game.playtime2WeeksMinutes > 0
                ? formatPlaytime(game.playtime2WeeksMinutes)
                : "—"}
            </dd>
          </div>
        </dl>
      )}

      {game && <GameScreenshotStrip appid={appid} />}

      {game && <GameUnlockTimeline appid={appid} />}

      {game && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CompletionVerdictCard appid={appid} />
          <TimeTo100Card appid={appid} />
          <LastProgressedCard appid={appid} />
          <RaritySignatureCard appid={appid} />
          <RarestUnlockCard appid={appid} />
        </div>
      )}
      {game && <AchievementPanel appid={appid} highlightTarget={ach} />}
    </div>
  );
}
