import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { useSteamForeverGames } from "@/steam/use-forever-games";
import { Link, createFileRoute } from "@tanstack/react-router";

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
  const { data, isPending, isError } = useSteamForeverGames();

  const game = data?.games.find((g) => g.appid === appid);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {game?.name ?? "Game detail"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Achievements, completion verdicts, and per-game timeline land in a later
            phase. Today: lifetime + recent playtime from the daily poller.
          </p>
        </div>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading playtime…</p>}

      {isError && (
        <p className="text-sm text-destructive">Playtime is unavailable right now.</p>
      )}

      {data && !game && (
        <p className="text-sm text-muted-foreground">
          App {appidParam} isn't in the current library snapshot. It may be unowned,
          refunded, or hidden from the public profile.
        </p>
      )}

      {game && (
        <div className="flex items-center gap-4 rounded-lg border bg-card/50 p-4">
          <img
            src={steamCapsuleUrl(game.appid)}
            alt=""
            width={184}
            height={69}
            loading="lazy"
            className="h-17.25 w-46 flex-none rounded-sm bg-muted object-cover"
          />
          <dl className="flex flex-1 flex-col gap-1 text-sm">
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
        </div>
      )}
    </div>
  );
}
