import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/champions")({
  component: ChampionsPage,
});

function ChampionsPage() {
  return (
    <p className="text-sm text-muted-foreground">
      Per-champion breakdown (games, win-rate, KDA, role mix) coming soon.
    </p>
  );
}
