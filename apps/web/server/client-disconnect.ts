// Benign upstream noise from `@tanstack/react-router`, logged whenever a client
// disconnects mid-SSR-stream. The library's own abort guard misses it: React
// synthesizes a fresh `Error` for `abort(undefined)`, and that object is neither
// the request signal's reason nor named `AbortError`, so its `onError` reports
// it as a render failure. On a public site this fires constantly, and without
// the filter it would drown the error tracker from the first day.
//
// Its own module so the predicate can be tested without importing
// `instrument.ts`, whose entire purpose is to call `Sentry.init`.
const CLIENT_DISCONNECT = /The render was aborted by the server without a reason/;

type MaybeExceptionEvent = {
  exception?: { values?: Array<{ value?: string | undefined }> };
};

export function isClientDisconnect(event: MaybeExceptionEvent): boolean {
  const values = event.exception?.values ?? [];
  return values.some((entry) => CLIENT_DISCONNECT.test(entry.value ?? ""));
}
