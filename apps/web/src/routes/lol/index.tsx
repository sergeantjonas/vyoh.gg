import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/")({
  beforeLoad: () => {
    throw redirect({ to: "/lol/matches" });
  },
});
