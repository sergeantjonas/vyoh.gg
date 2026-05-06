import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam")({
  component: SteamPage,
});

function SteamPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Steam</h1>
      <p className="text-sm text-muted-foreground">
        Steam integration is planned. Recent activity, playtime, and achievements will
        land here.
      </p>
    </div>
  );
}
