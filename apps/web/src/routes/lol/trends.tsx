import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/trends")({
  component: TrendsPage,
});

function TrendsPage() {
  return (
    <p className="text-sm text-muted-foreground">
      Trend charts (winrate over time, KDA, champion pool diversity) coming soon.
    </p>
  );
}
