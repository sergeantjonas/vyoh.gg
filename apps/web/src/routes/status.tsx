import { routeMeta } from "@/lib/route-meta";
import { StatusPage } from "@/status/status-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () =>
    routeMeta({
      title: "Status · vyoh.gg",
      description: "Upstream integration status for vyoh.gg.",
    }),
});
