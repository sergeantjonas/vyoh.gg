import * as Sentry from "@sentry/react";
import { scrubPayload } from "@vyoh/shared";
import {
  BENIGN_ERROR_PATTERNS,
  type EarlyError,
  earlyErrorValue,
} from "./lib/early-errors";
import type { ErrorTier } from "./lib/report-error";

/**
 * Error reporting for the browser. Imported first in `client.tsx` for its side
 * effect, so the SDK's global handlers are installed before anything hydrates.
 *
 * The DSN is a **build** argument, not a runtime one: Vite bakes it into the
 * bundle, so changing it means rebuilding the web image rather than editing a
 * file on the box. That puts it in the same class as `VITE_API_URL`. It is
 * public by design — a DSN is an ingest endpoint, not a credential — which is
 * why it rides a GitHub Actions repository *variable* rather than a secret.
 *
 * An absent DSN disables the SDK, so this is inert until the value is set and
 * silent in every local run and every test.
 *
 * Loaded as its own chunk rather than statically, so the SDK's ~27 kB stays off
 * the initial bundle and the route budget in docs/repo-conventions-web.md still
 * holds. `reportEarlyErrors` below is what pays for that: see
 * `lib/early-errors.ts` for the window it closes.
 */

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // `vite.config.ts` falls back to "dev" when no BUILD_COMMIT is set and there
  // is no git to ask. That is a useful string on the status page and a bad
  // release name here — it would collect every unversioned build into one
  // bucket — so it maps to undefined, matching the SSR tier's `|| undefined`.
  release: __BUILD_COMMIT__ === "dev" ? undefined : __BUILD_COMMIT__,
  // Browser notices that reach `window.onerror` without anything being wrong.
  // `early-errors.ts` drops them before they can fill the pre-init buffer; this
  // covers the same events once the SDK's own handler is the one catching them.
  ignoreErrors: [...BENIGN_ERROR_PATTERNS],
  sendDefaultPii: false,
  // `|| 1` rather than `??`, for the reason spelled out in the api's
  // `instrument.ts`: a set-but-empty value parses to 0, which the SDK accepts
  // as valid and then uses to discard every error while still looking enabled.
  //
  // The lever matters more here than on either server. This is the only tier
  // whose event volume scales with visitors rather than with owner activity,
  // so it is the one that can burn a month of quota in an afternoon.
  sampleRate: Number(import.meta.env.VITE_SENTRY_SAMPLE_RATE || 1),
  // Tracing is omitted rather than zeroed: the SDK gates on `!= null`, so a
  // zero still installs the whole performance stack and builds a span per
  // navigation before discarding it.
  //
  // Every path out goes through the shared scrubber, not just `event.message`.
  // A browser event carries breadcrumbs of outbound fetch URLs, and the api's
  // Steam calls pass their key as a query parameter — which is F-5 again, one
  // layer further out. See docs/working-notes/ops/error-tracking.md.
  beforeSend: scrubPayload,
  beforeSendTransaction: scrubPayload,
  beforeBreadcrumb: scrubPayload,
});

/**
 * Report whatever was thrown before this chunk arrived.
 *
 * `handled: false` because these reached a global handler rather than a catch,
 * which is what puts them in Sentry's unhandled bucket alongside the errors the
 * SDK's own listeners would have caught had they been installed in time. The
 * type is split for the same reason: the SDK labels its own two handlers
 * `onerror` and `onunhandledrejection`, and a replayed rejection filed under
 * the wrong one groups against the wrong issues.
 */
export function reportEarlyErrors(events: readonly EarlyError[]): void {
  for (const event of events) {
    Sentry.captureException(earlyErrorValue(event), {
      mechanism: {
        type: "reason" in event ? "onunhandledrejection" : "onerror",
        handled: false,
      },
    });
  }
}

/**
 * Report an error the app itself caught — a boundary, a rejected loader, a
 * failed mutation. Reached only through `lib/report-error.ts`, which is what
 * keeps this module out of the initial bundle.
 *
 * `handled: true` because something *did* catch it and showed the visitor a
 * fallback. That is the honest signal and it matters for triage: these sit
 * apart from the crashes nothing caught, which arrive through the global
 * handlers as `handled: false`.
 */
export function captureAppError(error: unknown, tier: ErrorTier): void {
  // A scope rather than one options object: Sentry's second argument is an
  // *exclusive* union, so `tags` (scope context) and `mechanism` (event hint)
  // cannot travel together in a single call.
  Sentry.withScope((scope) => {
    scope.setTag("tier", tier);
    Sentry.captureException(error, {
      mechanism: { type: "generic", handled: true },
    });
  });
}
