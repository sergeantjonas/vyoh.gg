import { OrbGlyph } from "@/components/orb-glyph";
import { Button } from "@/components/ui/button";
import { type ErrorTier, reportError } from "@/lib/report-error";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

// The route tier of the error vocabulary, sitting between `AppErrorFallback`
// (whole document is gone) and `WidgetErrorFallback` (one chart is gone) in
// error-boundary.tsx. It exists because SSR made route loaders load-bearing:
// before chunk 4 a failed fetch surfaced as a `useQuery` error branch inside an
// otherwise-fine page, and now the same failure rejects a loader, which the
// router escalates to the nearest errorComponent. With no route-level one, that
// is the root — so a single failing endpoint takes down nav, backdrop and
// palette along with the content, and on a cold server render takes down the
// document.
//
// Retry re-runs the loader through `router.invalidate()` rather than reloading
// the document. Reloading would work, but it throws away every other route's
// primed cache to re-fetch the one thing that failed, and on a slow upstream
// that reads as a much heavier recovery than it is.
export function RouteErrorFallback({
  error,
  reset,
  tier = "route",
}: ErrorComponentProps & { tier?: ErrorTier }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  // In an effect rather than at render: this component renders on the server
  // too, and a retry re-renders it, so reporting inline would double-count a
  // single failure. Keyed on the error so a genuinely new one still reports.
  // A rejected loader never reaches a React boundary — the router catches it
  // and swaps in this component — so nothing else would report it.
  //
  // `<StrictMode>` double-invokes effects in development, so a dev run reports
  // twice. That is the dev build, not a bug here.
  useEffect(() => {
    reportError(error, tier);
  }, [error, tier]);

  async function retry() {
    setRetrying(true);
    try {
      // `reset` clears the boundary; `invalidate` is what actually re-runs the
      // rejected loader. Both are needed: resetting alone re-renders straight
      // back into the cached rejection.
      reset();
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
      <OrbGlyph className="size-16" />
      <p className="text-sm font-medium text-destructive">This section could not load.</p>
      {error.message && (
        <p className="max-w-md font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={retry}
        disabled={retrying}
      >
        {retrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
