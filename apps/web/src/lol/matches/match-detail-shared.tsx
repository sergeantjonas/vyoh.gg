// Sized placeholder matching the typical chart height so the Suspense
// boundary's flip from fallback → mounted chart doesn't shove sibling
// content during the dynamic import's network round-trip.
export function ChartFallback() {
  return (
    <div className="h-64 animate-pulse rounded-lg border border-border/40 bg-muted/30" />
  );
}
