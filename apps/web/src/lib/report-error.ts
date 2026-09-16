/**
 * The app's one way to hand an error to the tracker.
 *
 * Every caller here sits in the initial bundle, and `src/instrument.ts` is
 * deliberately not in it — statically importing `@sentry/react` from a boundary
 * or from `router.tsx` would pull the SDK's ~27 kB straight back over the size
 * budget the lazy chunk exists to stay inside. So the import stays dynamic.
 *
 * It costs nothing at runtime: `client.tsx` already starts that chunk on boot,
 * and a second `import()` of an in-flight or settled module resolves from the
 * module cache rather than issuing a second request. A report raised before the
 * chunk lands waits for it instead of being dropped.
 */

/**
 * Which tier caught it. Carried as a tag because severity differs by an order
 * of magnitude across them — a chart failing on degenerate data is a defect, a
 * root boundary catching is an outage — and an untiered issue list cannot tell
 * those apart.
 */
export type ErrorTier =
  /** router.tsx's outermost boundary, or a failed root loader: no shell left. */
  | "app-root"
  /**
   * __root's <Outlet> boundary. Rarer than it looks: the router wraps every
   * match in its own catch boundary, so a throw inside a route component is
   * caught there and tagged `route`. This one sees only what throws between
   * the Outlet and the match.
   */
  | "page"
  /** A single fragile leaf — a chart, the splash backdrop — failing small. */
  | "widget"
  /** A rejected route loader, or a throw inside a route component. */
  | "route"
  /** A failed mutation: an owner-initiated write that did not happen. */
  | "mutation";

export function reportError(error: unknown, tier: ErrorTier): void {
  // Vite substitutes a literal here per build, so the dynamic import below is
  // removed from the server bundle outright rather than guarded at runtime. The
  // SSR tier reports through `server/instrument.ts`, which is a different SDK
  // against a different process; loading the browser one here would initialise
  // `@sentry/react` inside Node.
  if (import.meta.env.SSR) return;

  void import("../instrument")
    .then(({ captureAppError }) => {
      captureAppError(error, tier);
    })
    .catch(() => {
      // The reporter is what failed. Nothing useful is left to try.
    });
}
