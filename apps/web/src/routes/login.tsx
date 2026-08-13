import { LoginPage } from "@/auth/login-page";
import { type LoginError, isLoginError, safeNext } from "@/auth/login-search";
import { routeMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";

// `| undefined` rather than `?` — the validator always returns both keys, and
// `exactOptionalPropertyTypes` treats "absent" and "present but undefined" as
// different shapes.
type LoginSearch = { error: LoginError | undefined; next: string | undefined };

export const Route = createFileRoute("/login")({
  component: LoginRoute,
  // Both params arrive from the api's callback redirect, which means they also
  // arrive from anything that can get someone to click a link. `error` is
  // narrowed to the three the callback emits so an arbitrary string can't be
  // rendered as page copy, and `next` goes through the same path check the api
  // applies to the signed state — this one ends up in an href.
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: isLoginError(search.error) ? search.error : undefined,
    next: safeNext(search.next),
  }),
  head: () =>
    routeMeta({
      title: "Sign in · vyoh.gg",
      description: "Owner sign-in for the vyoh.gg admin controls.",
      // Nothing here is worth a search result, and the page exists for exactly
      // one person who already knows the URL.
      noindex: true,
    }),
});

function LoginRoute() {
  const { error, next } = Route.useSearch();
  return (
    <LoginPage
      {...(error === undefined ? {} : { error })}
      {...(next === undefined ? {} : { next })}
    />
  );
}
