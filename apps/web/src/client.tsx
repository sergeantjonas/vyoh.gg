// Must stay the first import: it installs the error listeners as a module side
// effect, and everything imported above it evaluates unwatched. See the module.
import { earlyErrors } from "@/lib/early-errors-install";
import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

/**
 * Browser entry. Start generates this file itself when `src/client.tsx` is
 * absent, and the plugin resolves ours ahead of its own the moment it exists
 * (`resolveEntry({ type: 'client entry' })` in @tanstack/start-plugin-core).
 *
 * It exists to own what happens before hydration. The SDK is imported as its
 * own chunk, because statically bundling it put the initial JS 24 kB over the
 * budget in `.size-limit.cjs` — measured, not assumed. That defers the SDK's
 * `error` and `unhandledrejection` handlers by a round trip, so a native buffer
 * goes up first and replays into Sentry once the chunk lands. Without it the
 * unreported window covers hydration, which is the failure with no other way to
 * be seen: a module that throws while evaluating leaves no tree to catch it.
 *
 * The body below is a copy of Start's default entry, so it has to be re-checked
 * against that file on a Start upgrade. That is the cost of the override, and
 * it is the small half: there is no supported hook for "run this before
 * hydration" short of owning the entry.
 */

// Starts the chunk request immediately and never blocks hydration. `stop()`
// runs on both settle paths, so a failed chunk load leaves no listeners holding
// events nobody will drain.
void import("./instrument")
  .then(({ reportEarlyErrors }) => {
    reportEarlyErrors(earlyErrors.drain());
  })
  .catch(() => {
    // Nothing useful to do: the reporter is what failed.
  })
  .finally(() => {
    earlyErrors.stop();
  });

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
