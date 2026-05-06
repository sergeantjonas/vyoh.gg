import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">vyoh.gg</h1>
      <p className="text-sm text-muted-foreground">
        Cross-platform gaming dashboard. Aggregate stats land here. For now, head to{" "}
        <span className="text-foreground">LoL</span> for match history.
      </p>
    </div>
  );
}
