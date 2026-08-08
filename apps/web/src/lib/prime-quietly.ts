// Awaits route-loader primes whose failure the route is meant to survive.
//
// A loader that rejects is escalated by the router to the nearest
// `errorComponent`, and on a server render the document comes back HTTP 500.
// That is the right answer when the primed query *is* the page — a 200 over an
// empty state teaches a crawler the page is empty, while a 500 says come back —
// and the wrong one when the query is a single region of a page that still has
// something true to say without it.
//
// `allSettled` rather than `Promise.all(…).catch()`: `all` settles the instant
// either input rejects, so a slower sibling that was going to succeed never
// lands in the dehydrated cache it had already earned. The distinction only
// shows up when one of several primes fails, which is exactly when it matters.
//
// The caller passes promises rather than a thunk, so every prime is already
// in flight by the time this runs — the handler `allSettled` attaches lands in
// the same tick, which is what keeps a rejection from surfacing as unhandled.
export async function primeQuietly(
  ...primes: readonly Promise<unknown>[]
): Promise<void> {
  await Promise.allSettled(primes);
}
