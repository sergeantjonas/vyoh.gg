import { GithubIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { API_PUBLIC_URL } from "@/lib/api-url";
import { useRouterState } from "@tanstack/react-router";

/**
 * Hands the browser to the api's GitHub login route.
 *
 * A real `<a href>` rather than a click handler doing `location.assign`: the
 * whole point of the flow is a top-level navigation off-origin, so the element
 * that expresses it should be the one the browser already knows how to
 * middle-click, and the href should be visible in the status bar before the
 * click.
 *
 * `API_PUBLIC_URL`, not `API_URL` — this is rendered into markup rather than
 * fetched, and the internal origin is unreachable from the visitor's browser.
 */
export function LoginButton({ next }: { next?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const target = next ?? pathname;
  const href = `${API_PUBLIC_URL}/auth/github/login?next=${encodeURIComponent(target)}`;

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} rel="nofollow">
        <GithubIcon aria-hidden />
        Log in with GitHub
      </a>
    </Button>
  );
}
