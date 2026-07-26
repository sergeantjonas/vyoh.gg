// The api's origin, in the two forms the app needs. Callers compose their own
// paths onto these; this module owns the origin and nothing else.
//
// The two are the same string today and diverge the moment the app renders on
// a server, which is why the split lands before SSR does rather than after:
//
//   - Anything *rendered* — <img src>, <video src>, og:image — has to be
//     byte-identical on the server and in the browser. A server-only origin
//     baked into markup is both a hydration mismatch and a URL the visitor
//     cannot resolve. That is API_PUBLIC_URL, which reads neither `window`
//     nor `process` so it cannot vary by side.
//   - Anything *fetched* — fetch(), EventSource — should take the shortest
//     route from wherever the call runs. From a route loader inside the Node
//     process that is the internal origin: going back out to the public
//     hostname buys a DNS + TLS round-trip into the same machine, and the
//     target VPS binds the api to loopback only, so there is no route at all.
//     That is API_URL.
//
// Deployment shape this encodes (docs/working-notes/ops/hosting.md § Topology):
// Nginx serves `vyoh.gg` and `api.vyoh.gg` as separate vhosts, so the public
// base is an absolute origin rather than a path prefix on the web origin. A
// prefix could not work here regardless — the api serves `/lol/summoners/…`
// while the web app owns `/lol/$accountSlug/…`, and no prefix rule separates
// an account slug from a literal route segment.

// `process` sits outside this package's type scope on purpose: tsconfig.app.json
// pins `types: ["vite/client"]` so Node globals cannot leak into browser code.
// Declaring the one field the server branch reads keeps that boundary intact.
declare const process: { env: Record<string, string | undefined> } | undefined;

// Vite serves the app on :2009 while Nest listens on :2010, so in dev the
// browser is genuinely cross-origin and the base has to be absolute. This is
// also the literal every fetch assertion in the suite compares against.
const DEV_ORIGIN = "http://localhost:2010";

/**
 * Absolute, browser-reachable origin of the api, baked at build time from
 * `VITE_API_URL`.
 *
 * Use for URLs that get **rendered into markup**. Identical on both sides of a
 * server render by construction.
 */
export const API_PUBLIC_URL: string = import.meta.env.VITE_API_URL ?? DEV_ORIGIN;

function resolveFetchOrigin(): string {
  // Vite substitutes a literal for `import.meta.env.SSR` per build, so the
  // `process` access below is dead code in the client bundle rather than a
  // guard evaluated at runtime.
  if (!import.meta.env.SSR) return API_PUBLIC_URL;
  if (typeof process === "undefined") return API_PUBLIC_URL;
  return process.env.API_INTERNAL_URL ?? API_PUBLIC_URL;
}

/**
 * Origin `fetch` should target from wherever this module is running — the
 * internal origin under SSR, the public one in the browser.
 *
 * Use for requests the app **makes**. Never render it: server-side it is an
 * origin the visitor cannot reach.
 */
export const API_URL: string = resolveFetchOrigin();
