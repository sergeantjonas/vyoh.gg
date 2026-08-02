/**
 * Month and year, pinned to UTC. An unpinned `Intl.DateTimeFormat` resolves to
 * the process zone, and the production container has none — so the server would
 * render a different month than the browser for any date near a boundary, and
 * React discards the whole tree over the mismatch. See the container-divergence
 * rule in docs/repo-conventions.md.
 *
 * Nothing here is derived from the current clock, deliberately: "13 years ago"
 * would be computed at two different instants on the two sides of hydration.
 */
export const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
});

export function monthAndYear(iso: string): string {
  const date = new Date(iso);
  return `${MONTH_FORMAT.format(date)} ${date.getUTCFullYear()}`;
}
