// Routes can opt into owning their initial entrance (skipping the global
// scope-change fade in `<RootLayout>`) by setting
//   staticData: { ownsEntry: true }
// on their `createFileRoute`. When the active match chain contains an
// owns-entry route, the global `<m.div key={scope}>` short-circuits its
// `initial` so the route's own variants (e.g. landing's editorial cascade) are
// the only entrance the user sees.
//
// Reading the *whole* match chain (not just the leaf) so a parent route can
// claim ownership for every leaf under it — useful when a section like
// `/lol/$accountSlug` wants its children's transitions handled by section-
// internal motion rather than the global fade.

type MatchWithStaticData = {
  staticData?: { ownsEntry?: unknown };
};

export function routeOwnsEntry(matches: readonly MatchWithStaticData[]): boolean {
  return matches.some((match) => match.staticData?.ownsEntry === true);
}
