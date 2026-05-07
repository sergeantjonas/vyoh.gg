import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/lol/$accountSlug/matches",
      params,
    });
  },
});
