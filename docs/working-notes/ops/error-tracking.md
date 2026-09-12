# Error tracking — wiring the launch gate

**Status:** Active — **scoped 2026-09-13, not started.** The gate itself is [observability-floor.md § Chunk 2](observability-floor.md); this note is its analysis and plan. The decision it was waiting on is made here: **hosted Sentry at launch, self-hosting deferred and cheap to revisit.** The work is three chunks and needs no box. Nothing about it is novel except the redaction problem, which is the one part that can make this change *worse* than shipping without it — read that section before writing any code.

## The decision

**Hosted Sentry free tier.** Three reasons, in order of weight:

1. **It survives the thing it monitors.** A tracker on the same VPS cannot report that the VPS is gone, and that is the failure it most needs to report. Single-box deployments have no second box to fall back to.
2. **It costs no memory.** The 16 GB in [hosting.md § Sizing implications](hosting.md#sizing-implications) is budgeted for vyoh plus a few more tenants. Sentry self-hosted wants roughly the whole box; GlitchTip or Bugsink want a few hundred MB and a database, which fits but is not free.
3. **The free tier is far past this app's volume.** A single-owner dashboard with a handful of visitors does not generate thousands of distinct errors a month. If it does, that is the signal, not the cost problem.

**What would change it:** a real need to keep error payloads on infrastructure we own — which for a public portfolio dashboard with no third-party user data is hard to argue — or blowing the free tier persistently.

**Why this is a cheap decision to get wrong.** Instrumentation targets Sentry's *protocol*, not its hosting. GlitchTip and Bugsink both speak it, so moving later is a DSN change and a redeploy, not re-instrumentation. That is the reason not to agonise here, and the reason self-hosting is a legitimate later move rather than a road not taken. GlitchTip would slot into the one-cluster-database-per-project convention already described in [hosting.md § Per-component conventions](hosting.md).

**Rejected: self-hosting Sentry itself.** Not a close call — its stack is sized for organisations, and running it beside the app it watches fails reason 1 anyway.

## Where it hooks — six points, all of which already exist

On the request and cron paths, every exception is already caught; those catch sites simply have nowhere to send anything. That makes this a wiring job rather than a refactor, and it keeps the instrumentation small enough to review. It is **not** true that the processes are fully guarded: no `unhandledRejection` or `uncaughtException` handler exists anywhere in `apps/`, so a stray rejection off those paths still dies silently. Both SDKs install their own, which is a real side benefit of doing this at all.

**api**

- **[fallback-exception.filter.ts](../../../apps/api/src/fallback-exception.filter.ts)** is `@Catch()` and classifies every failure into a `Verdict`. Its `verdict.log` field is *deliberately undefined for a deliberate 4xx* — the comment there says those "are the handler's own answer and logging them would only bury the real failures". **That field is the report signal, but the level is not the predicate.** Read `classify()` before wiring: 5xx `HttpException`, `SteamRateLimiterTimeoutError` and every `SteamClientError` 429/502/504 all log at **`warn`**; only Prisma errors and the unknown catch-all reach `error`. So `level === "error"` would drop every upstream 5xx — including the Steam failure this note asks you to verify with. **Report where `verdict.log` is present and `verdict.status >= 500`**, which reports real failures and still never reports a 404 or a validation rejection. Getting this backwards is how a tracker becomes noise that nobody reads within a week.
- **[sync-job-registry.service.ts](../../../apps/api/src/sync-jobs/sync-job-registry.service.ts)** already catches every cron failure, logs the stack, and stores a redacted one-liner for `/status`. Its `catch` is where a *background* failure should report, and it is the more valuable of the two: a cron that has been failing for a week is exactly the thing nobody notices, and `/status` shows only the latest run.

**web**

- **[error-boundary.tsx](../../../apps/web/src/components/error-boundary.tsx)** already exposes `onError?: (error: Error, info: ErrorInfo) => void`, invoked from `componentDidCatch`. Every boundary in the app routes through this one component, so a single default here covers the whole tree. Note [__root.tsx](../../../apps/web/src/routes/__root.tsx) already passes its own `onError` to play a sound — the reporting hook must compose with that rather than replace it.
- **`defaultErrorComponent` / `errorComponent`** in [router.tsx](../../../apps/web/src/router.tsx) and `__root.tsx` catch route-tier failures, which bypass the React boundary.
- **[node-adapter.ts](../../../apps/web/server/node-adapter.ts)** wraps every request in a `.catch()` that `console.error`s and writes a 500. This is where **SSR render failures** surface — they never reach a React boundary, because on the server there is no mounted tree left to catch them — and it is the natural `@sentry/node` init site for the web tier.
- **`QueryCache` / `MutationCache` `onError`** in `router.tsx`. Read the existing guard before touching it: the query handler returns early unless `query.state.data !== undefined`, so it only fires for **background refresh** failures, with initial-load failures going to the error component instead. Those are already surfaced as a toast and are frequently just a flaky upstream, so **sample them or leave them out** — they are the most likely source of quota burn in the whole app. `MutationCache.onError` has **no such guard** and fires on every mutation failure; those are owner-initiated writes and are worth reporting, so do not treat the two handlers as one decision.

## The redaction problem — read before writing code

This is the part that can make the change a regression. [F-5 in api-exposure-audit.md](api-exposure-audit.md) was the Steam Web API key being written to our own logs in cleartext on any fetch failure, because Steam passes its key as a query parameter. It was fixed 2026-08-03. **Sending error payloads to a third party re-opens exactly that surface, one layer out.**

`redactSecrets()` in the sync-job registry is the existing defence, and it is **necessary but not sufficient here**. Its regex is `([?&][^=&\s"']*(?:key|token|secret)=)[^&\s"']+` — it scrubs secret-looking **query parameters in a message string**. A Sentry event is much wider than a message: breadcrumbs (including outbound HTTP URLs), request headers, stack-frame locals, and anything attached as `extra` or tags.

**How to apply:** implement a `beforeSend` (and `beforeSendTransaction`, and a breadcrumb hook) that walks the whole event and applies the same pattern, rather than scrubbing only `event.message`. Hoist the regex into `packages/shared/src/` first so one definition covers the registry and the SDK config — per the cross-package-utilities rule in [repo-conventions.md](../../repo-conventions.md), a helper that escapes into a second package must be consolidated. Set `sendDefaultPii: false` explicitly rather than relying on the default. Then **verify by triggering a real Steam failure and reading the event in the Sentry UI**, not by reading the code — this is the one requirement in this note that a test cannot honestly close, because the thing being checked is what left the process.

## Sourcemaps

Recorded in [frontend-2026-gaps.md:501](../cross-cutting/frontend-2026-gaps.md): no sourcemap or upload pipeline exists. Confirmed 2026-09-13 — [vite.config.ts](../../../apps/web/vite.config.ts) sets `build.target` and `build.manifest` and no `build.sourcemap`, so the Vite production default of `false` applies. The `sourceMap: true` further up that file belongs to a Lightning CSS `transformCss` call and is a different API entirely. **Without this, every web stack trace Sentry shows is minified and useless**, which quietly makes the whole web half of this work worthless while appearing to succeed.

The usual objection to shipping sourcemaps is that they expose your source. **That objection does not apply here: the repo is public.** There is nothing to protect, so the simple path is available — generate them and let them be resolvable — rather than the upload-then-delete dance a closed-source project needs. Prefer Sentry's Vite plugin so releases are tagged and traces resolve without a fetch round-trip, but the fallback of simply serving them is acceptable and is not a security finding in this repo.

## Noise to filter before the first deploy

A tracker that cries wolf is worse than none, and each of these is known in advance:

- **TanStack SSR aborts.** "render was aborted by the server" fires whenever a client disconnects mid-render. Upstream noise, not a bug, and on a public site it happens constantly. Drop it in `beforeSend`.
- **Prefetch traffic.** [speculation-rules-prefetch.md:32](../cross-cutting/speculation-rules-prefetch.md) already sets the constraint that prefetch requests must not pollute error-tracking attributes.
- **Background query refresh failures**, per the `QueryCache` note above.
- **Quota guard.** Set a sample rate before the first deploy, not after. A crash loop can burn a month of free tier in minutes, and the deploy that causes it is exactly when the tracker must still be working.

## Chunks

Each is independently committable and needs no VPS.

- **E1 — api.** `@sentry/nestjs`, an `instrument.ts` imported before any other module, the two api hook points, the shared redaction helper and `beforeSend`. Verified by triggering a real upstream failure and reading the event.
- **E2 — web runtime.** SDK init at both ends, `ErrorBoundary` default `onError` composed with the existing one, route error components, and the cache-handler decision. `@sentry/tanstackstart-react` combines the React and Node SDKs but was still beta as of 2026-09; if that is unwelcome on the portfolio's own surface, the stabler path is `@sentry/react` on the client plus `@sentry/node` in the adapter, wired by hand. **Check the SDK's status at implementation time rather than trusting this line.**
- **E3 — sourcemaps and releases.** `build.sourcemap`, the Sentry Vite plugin, release tagging off `BUILD_COMMIT`, which is already threaded end to end: a `compose.prod.yaml` build arg, an `ARG` in `apps/web/Dockerfile`, and the `__BUILD_COMMIT__` define in `vite.config.ts`. Lands after E2 because it only has value once web events exist.

**Sequencing:** E1 alone closes the gate in [pre-launch-sweep.md](pre-launch-sweep.md) in the sense that matters — the api is where a silent production failure actually hurts. E2 and E3 should follow before launch but would not, on their own, justify holding it.
