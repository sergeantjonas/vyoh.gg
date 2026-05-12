import { StatusPage } from "@/status/status-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/status")({
  component: StatusPage,
});
