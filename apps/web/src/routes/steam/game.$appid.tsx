import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/game/$appid")({
  component: SteamGamePage,
});

function SteamGamePage() {
  const { appid } = Route.useParams();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
        Steam · App {appid}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">Game detail</h1>
      <p className="text-sm text-muted-foreground">
        Per-game playtime, achievements, and verdicts will land here. Pulled from Steam's
        public profile endpoints — no OAuth required.
      </p>
    </div>
  );
}
