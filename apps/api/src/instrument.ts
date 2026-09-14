// Imported for its side effect, and imported *first*: the SDK patches the
// libraries it instruments as they are loaded, so anything required ahead of
// this runs uninstrumented.
import * as Sentry from "@sentry/nestjs";
import { scrub } from "./sentry-scrub";

Sentry.init({
  // An absent DSN disables the SDK rather than failing, which is what lets this
  // wiring ship before the account exists — inert until the value is set, so
  // switching reporting on is a config change rather than a code change. It is
  // also how every test and local run stays silent without special-casing.
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // The same deploy SHA the web image already carries, so an event names the
  // build it came from rather than "production".
  release: process.env.BUILD_COMMIT || undefined,
  // Explicit rather than defaulted: this app's errors quote summoner names and
  // Steam ids, and none of that needs attaching to a person.
  sendDefaultPii: false,
  // `tracesSampleRate` is *omitted*, not zeroed. The SDK decides whether to
  // install its performance machinery on `tracesSampleRate != null`, so a 0
  // still loads the Express, Prisma, pg and http instrumentation along with
  // OpenTelemetry, builds a span per request and throws it away. Absent is what
  // actually means "no tracing", and tracing is the largest quota consumer
  // while buying nothing here — paint budgets are measured in the browser.
  //
  // `|| 1` rather than `??`: a set-but-empty `SENTRY_SAMPLE_RATE=` yields
  // `Number("") === 0`, which the SDK accepts as a valid rate and then drops
  // every error while still looking enabled. That is the worst failure this
  // file can have, so empty falls back rather than being honoured.
  sampleRate: Number(process.env.SENTRY_SAMPLE_RATE || 1),
  beforeSend: scrub,
  beforeSendTransaction: scrub,
  beforeBreadcrumb: scrub,
});
