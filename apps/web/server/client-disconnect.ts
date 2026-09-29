// A client disconnecting mid-SSR-stream surfaces in two forms, and neither is a
// failure — the client is already gone. On a public site this fires
// constantly, and without the filter it would drown the error tracker from the
// first day.
//
// - Upstream noise from `@tanstack/react-router`. The library's own abort guard
//   misses it: React synthesizes a fresh `Error` for `abort(undefined)`, and
//   that object is neither the request signal's reason nor named `AbortError`,
//   so its `onError` reports it as a render failure.
// - `ERR_STREAM_PREMATURE_CLOSE` from the adapter's `pipeline` into the
//   response: nginx proxies the document unbuffered, so the visitor hanging up
//   closes our socket before the body finishes.
//
// Its own module so the predicate can be tested without importing
// `instrument.ts`, whose entire purpose is to call `Sentry.init`.
const RENDER_ABORT = /The render was aborted by the server without a reason/;

// `proxy_read_timeout` in deploy/nginx/vyoh.gg.conf. nginx timing out a stalled
// render closes our socket exactly as a departing visitor does, so a premature
// close only counts as a disconnect when the request ended before that timeout
// could fire. Past it, the event is the only trace a hung render leaves.
const UPSTREAM_READ_TIMEOUT_MS = 60_000;

type MaybeExceptionEvent = {
  exception?: { values?: Array<{ value?: string | undefined }> };
  extra?: Record<string, unknown>;
};

export function isClientDisconnect(event: MaybeExceptionEvent): boolean {
  const values = event.exception?.values ?? [];
  if (values.some((entry) => RENDER_ABORT.test(entry.value ?? ""))) return true;
  // The outermost error only, which Sentry lists last: `linkedErrors` appends
  // each `cause`, and a failure that merely wraps a premature close is not one.
  const elapsedMs = event.extra?.elapsedMs;
  return (
    values.at(-1)?.value === "Premature close" &&
    typeof elapsedMs === "number" &&
    elapsedMs < UPSTREAM_READ_TIMEOUT_MS
  );
}
