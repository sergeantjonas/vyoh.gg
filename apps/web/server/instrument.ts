import * as Sentry from "@sentry/node";
import { scrubPayload } from "@vyoh/shared";
import { isClientDisconnect } from "./client-disconnect.ts";

/**
 * Error reporting for the SSR tier. Imported first in `index.ts` for its side
 * effect; an absent `SENTRY_DSN` disables the SDK, so this is inert until the
 * value is set and silent in every local run.
 *
 * Kept erasable-syntax-only along with the rest of `server/` — this file runs as
 * raw TypeScript under Node's type stripping, not through a build.
 */

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.BUILD_COMMIT || undefined,
  sendDefaultPii: false,
  // Omitted rather than zeroed, and `|| 1` rather than `??`, for the reasons
  // spelled out in the api's `instrument.ts`: a zero still installs the whole
  // performance stack, and a set-but-empty sample rate parses to 0 and silently
  // discards every error.
  sampleRate: Number(process.env.SENTRY_SAMPLE_RATE || 1),
  beforeSend: (event) => (isClientDisconnect(event) ? null : scrubPayload(event)),
  beforeSendTransaction: scrubPayload,
  beforeBreadcrumb: scrubPayload,
});
