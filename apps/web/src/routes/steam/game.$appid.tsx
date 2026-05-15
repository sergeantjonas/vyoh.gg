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
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/steam/game/$appid")({
  component: SteamGamePage,
});

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

function SteamGamePage() {
  const { appid: appidParam } = Route.useParams();
  const appid = Number.parseInt(appidParam, 10);
  const { data, isPending, isError } = useSteamOwnedGames();

  const game = data?.games.find((g) => g.appid === appid);

  // Not every Steam game ships `library_hero.jpg` / `logo.png` — these are
  // part of the newer library-presentation asset set, missing on plenty of
  // older or indie titles. wsrv.nl forwards the upstream 404 to the browser
  // and we catch it via `onError` to swap to a graceful fallback (blurred
  // header.jpg backdrop for the hero, the heading text for the logo).
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

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
          src={steamCapsuleUrl(appid, game?.headerPath, game?.assetTimestamp, 920)}
          alt=""
          className="absolute inset-0 size-full scale-110 object-cover blur-sm"
        />
        {!heroFailed && (
          <img
            src={steamLibraryHeroUrl(appid, game?.libraryHeroPath, game?.assetTimestamp)}
            alt=""
            loading="eager"
            onLoad={() => setHeroLoaded(true)}
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
            src={steamLibraryLogoUrl(appid)}
            alt={game?.name ?? `App ${appidParam}`}
            loading="eager"
            onLoad={() => setLogoLoaded(true)}
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
            Achievements, completion verdicts, and per-game timeline land in a later
            phase. Today: lifetime + recent playtime from the daily poller.
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
    </div>
  );
}
