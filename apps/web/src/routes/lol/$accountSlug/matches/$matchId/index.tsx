import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/matches/$matchId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/lol/$accountSlug/matches/$matchId/recap",
      params,
      replace: true,
    });
  },
});
