/**
 * Holds errors thrown before the Sentry chunk has loaded.
 *
 * The browser SDK is imported dynamically so its ~27 kB stays out of the
 * initial bundle (`src/client.tsx`), which costs a gap: the SDK installs its
 * own `error` and `unhandledrejection` handlers at init, and until that chunk
 * lands there is nothing listening. That window covers hydration — the one
 * failure with no other way to be seen, because a module that throws while
 * evaluating leaves no mounted tree for a boundary to catch.
 *
 * Two native listeners cost nothing and close it. They only hold events; the
 * SDK does the reporting once it arrives.
 *
 * Lives here rather than in `instrument.ts` so a test can reach it without
 * importing a module whose whole purpose is `Sentry.init` — the same split as
 * `server/client-disconnect.ts`, and for the same reason: the SDK installs
 * global handlers on init, which a test suite should not inherit.
 */

export type EarlyError = ErrorEvent | PromiseRejectionEvent;

export interface EarlyErrorBuffer {
  /** Everything held so far, clearing the buffer. */
  drain: () => EarlyError[];
  /** Stop listening. Safe to call more than once. */
  stop: () => void;
}

/**
 * `window` also fires `error` for a failed image or stylesheet, as a plain
 * `Event` with no error to report. Duck-typed rather than `instanceof` because
 * `PromiseRejectionEvent` is absent in happy-dom, where the tests run.
 */
function isEarlyError(event: Event): event is EarlyError {
  return "reason" in event || "error" in event || "message" in event;
}

/**
 * The value worth reporting out of a buffered event. A rejection carries
 * `reason`, an `ErrorEvent` carries `error` — which is absent for a cross-origin
 * script, where the message is all there is.
 */
export function earlyErrorValue(event: EarlyError): unknown {
  if ("reason" in event) return event.reason;
  if (event.error) return event.error;
  // No error object means no stack, and the SDK's own handler would have
  // synthesised a frame from these three. Folding them into the message keeps
  // the only location there is rather than reporting a bare sentence.
  const at = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : "";
  return `${event.message}${at}`;
}

/**
 * Messages the browser fires at `window.onerror` that are not faults.
 *
 * The ResizeObserver one is the spec's own bail-out: a callback resized
 * something inside the tree it observes, so the browser delivers one more round
 * and then reports whatever is left over. It means a frame's layout settled a
 * beat late, carries no error object and no stack, and nothing in the app is
 * broken when it fires — which makes it pure noise in an unhandled bucket.
 *
 * Applied to the buffer as well as to the SDK's own `ignoreErrors`, because the
 * buffer holds a bounded number of events: a burst of these during hydration
 * would evict the crash it exists to catch.
 */
export const BENIGN_ERROR_PATTERNS: readonly RegExp[] = [/^ResizeObserver loop/];

function isBenign(event: EarlyError): boolean {
  // A real throw carries an `error` object worth reporting whatever its message
  // says; these notices never do, so the absence is part of the match.
  const message = "message" in event && !event.error ? event.message : undefined;
  return (
    typeof message === "string" && BENIGN_ERROR_PATTERNS.some((p) => p.test(message))
  );
}

/**
 * `limit` bounds the hold rather than the reporting: a crash loop can fire
 * these faster than the chunk loads, and the first few carry the cause.
 */
export function bufferEarlyErrors(target: EventTarget, limit = 10): EarlyErrorBuffer {
  let held: EarlyError[] = [];

  const capture = (event: Event): void => {
    if (!isEarlyError(event)) return;
    if (isBenign(event)) return;
    if (held.length >= limit) return;
    held.push(event);
  };

  target.addEventListener("error", capture);
  target.addEventListener("unhandledrejection", capture);

  return {
    drain: () => {
      const out = held;
      held = [];
      return out;
    },
    stop: () => {
      target.removeEventListener("error", capture);
      target.removeEventListener("unhandledrejection", capture);
    },
  };
}
