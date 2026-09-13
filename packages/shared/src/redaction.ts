// Secret scrubbing for anything that leaves the process — log lines, the public
// `GET /status` payload, and error-tracker events.
//
// The need is concrete: several upstream clients build URLs by hand and carry
// their credential as a query parameter, Steam's Web API key among them, so any
// string quoting a failing URL carries a live secret. That is how the key
// reached our own logs in cleartext until 2026-08-03. Sending events to an
// error tracker re-opens the same surface one layer out, which is why this
// lives in shared rather than beside the one caller it started with.
//
// Everything here must be safe to run *inside* an error path: no unbounded
// recursion, no mutation of the caller's value, and no exception escaping — a
// property whose getter throws becomes the marker rather than propagating.
//
// Where it cannot vouch for a value it substitutes the marker rather than
// passing the original through. Losing context in a report is recoverable;
// leaking a credential into a third party's storage is not.
//
// One deliberate exception: a value that is neither string, array nor plain
// object — a Date, a class instance, an `Error` — passes through intact rather
// than being mangled into something it is not. That is safe for the caller this
// exists for, because an SDK normalises an event to plain JSON before
// `beforeSend` sees it. Do not hand it un-normalised objects and expect the
// guarantee to hold.

// A credential passed as a query parameter. Keeps the parameter name so a log
// line still says which one was redacted. The leading separator is optional
// because a query string does not always arrive with its `?` attached — Sentry
// stores `request.query_string` already stripped, and requiring the `?` would
// leave the *first* parameter unscrubbed, which is F-5 over again.
const SECRET_QUERY_PARAM =
  /((?:^|[?&])[^=&\s"']*(?:key|token|secret|password|credential|code)=)[^&\s"']+/gi;

// A key whose *value* is a credential in full — request headers, cookies, and
// anything an SDK attaches as structured context. Deliberately greedy: over-
// redacting a field named `tokenCount` costs nothing, missing one costs a key.
// `session` is bounded rather than bare: this app counts *play* sessions, so an
// unanchored match would erase `sessionCount` and friends from every report.
// Bounded, not narrowed — the owner's own cookie is `vyoh_session`, which a
// `session(id|key|token)`-only pattern misses, and that value is a live login.
// `cookies?` is anchored plural too, so the whole bag drops regardless of the
// names inside it. Bare `key` and `code` are anchored rather than loose: that
// is how a *parsed* query string presents Steam's Web API key and GitHub's
// OAuth authorization code, while unanchored they would swallow innocent
// neighbours like `keyboard` or `countryCode`.
//
// `code` is not free, and the cost is worth stating: `err.code` is the primary
// Node and Prisma diagnostic — `ECONNREFUSED`, `P2002` — and the fallback
// exception filter branches on it, so an SDK that surfaces it as an object key
// will have it redacted. That is the deliberate trade. Narrowing it back is how
// GitHub's OAuth authorization code leaks, which is the more expensive mistake.
const SECRET_KEY =
  /^(?:authorization|cookies?|set-cookie|proxy-authorization|key|code)$|(?:api[-_]?key|apikey|token|secret|password|passwd|credential|database[-_]?url|connection[-_]?string|(?:^|[-_])session(?:$|[-_])|session[-_]?(?:id|key|token))/i;

// A credential in a URL's userinfo — `postgresql://user:pass@host`. No `=`, so
// the query pattern cannot see it, and `DATABASE_URL` reaches the pg pool
// config verbatim, which an init failure can quote.
const URL_USERINFO = /([a-z][a-z0-9+.-]*:\/\/[^:/?#\s]+:)[^@/?#\s]+@/gi;

const REDACTED = "***";

// Deep enough for a Sentry event, shallow enough that a pathological structure
// cannot exhaust the stack while we are already handling an error.
const MAX_DEPTH = 12;

// Depth bounds how *far* we descend, not how much we visit. Because the cycle
// guard is scoped to the current path, a graph attaching the same subtree at
// several points is walked once per distinct path, which multiplies out — at
// six shared references per level it exhausts the heap. Charged per property
// and per array element, not merely per object — width is as unbounded as
// breadth, and charging only per object leaves the same failure one step over.
const MAX_VISITS = 50_000;

interface WalkState {
  /** Objects on the path being walked, not every object ever seen. */
  seen: WeakSet<object>;
  budget: number;
}

/** Redact credentials carried as query parameters in a single string. */
export function redactSecrets(message: string): string {
  return message
    .replace(SECRET_QUERY_PARAM, `$1${REDACTED}`)
    .replace(URL_USERINFO, `$1${REDACTED}@`);
}

/** True when a field's value should be dropped wholesale rather than scanned. */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

/**
 * Recursively redact secrets in JSON-shaped data — the shape an error-tracker
 * event has by the time a `beforeSend` hook sees it.
 *
 * Returns a new value; the input is never mutated. Strings are scanned for
 * secret query parameters, and any property whose *key* looks like a credential
 * is replaced entirely. Values that are neither strings, arrays nor plain
 * objects (dates, class instances, functions) pass through untouched — an event
 * that still contains one has not been normalised yet, and rebuilding it here
 * would lose more than it protects.
 *
 * A subtree past the depth cap, a cycle, and a property that cannot be read all
 * collapse to the marker.
 */
export function redactSecretsDeep<T>(value: T): T {
  try {
    return walk(value, 0, { seen: new WeakSet<object>(), budget: MAX_VISITS }) as T;
  } catch {
    // The value fought back — a proxy trap throwing from `ownKeys` or
    // `getPrototypeOf` is the realistic case. We are already inside an error
    // path, so the marker is the only answer that neither leaks nor replaces
    // one failure with a second.
    return REDACTED as T;
  }
}

function walk(value: unknown, depth: number, state: WalkState): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (value === null || typeof value !== "object") return value;
  // Past the cap, out of budget, or a cycle back onto the path we are already
  // walking. In each case we cannot vouch for what is underneath, so the marker
  // goes back rather than the raw subtree.
  if (depth >= MAX_DEPTH || state.budget <= 0 || state.seen.has(value)) return REDACTED;
  state.budget -= 1;

  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      // Indices go through `readOwn` for the same reason object keys do: `.map`
      // would invoke a throwing element getter itself.
      const items: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        // Charged per element: a sparse array declares a length without holding
        // the entries, so `length` alone bounds nothing.
        if (state.budget <= 0) {
          items.push(REDACTED);
          break;
        }
        state.budget -= 1;
        items.push(walk(readOwn(value, String(index)), depth + 1, state));
      }
      return items;
    }
    if (!isPlainObject(value)) return value;

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      // Charged per property for the same reason as per array element: the
      // budget bounds how many values we visit, but each visit builds an output
      // object whose width is the caller's to choose.
      if (state.budget <= 0) {
        // Mark the truncation rather than letting the object simply end: a
        // short object and an exhausted one look identical otherwise, and the
        // reader of a report needs to know which they have.
        Object.defineProperty(out, key, {
          value: REDACTED,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        break;
      }
      state.budget -= 1;
      const scrubbed = isSecretKey(key)
        ? REDACTED
        : walk(readOwn(value, key), depth + 1, state);
      // `__proto__` as an own key would hit the prototype setter and silently
      // re-parent `out`, dropping the property. `defineProperty` writes it as
      // the plain own property it was.
      Object.defineProperty(out, key, {
        value: scrubbed,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  } catch {
    // A value that fights back while being inspected collapses to the marker on
    // its own rather than taking the whole event with it. Containing it here
    // rather than only at the top matters: a report missing one hostile field
    // still says what broke, where a report replaced wholesale says nothing.
    return REDACTED;
  } finally {
    // Scoped to the current path, not the whole walk. One object attached at
    // two points — the same `data` on two breadcrumbs — must be scrubbed at
    // both, so only a genuine cycle may short-circuit.
    state.seen.delete(value);
  }
}

// A getter on a value we did not construct can throw, and this runs while the
// process is already handling an error.
function readOwn(source: object, key: string): unknown {
  try {
    return (source as Record<string, unknown>)[key];
  } catch {
    return REDACTED;
  }
}

// `Object.create(null)` counts: an SDK may hand back a null-prototype bag.
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}
