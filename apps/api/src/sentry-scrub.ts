import { redactSecretsDeep } from "@vyoh/shared";

/**
 * The single gate every payload passes through on its way to the error tracker.
 *
 * `redactSecretsDeep` answers with the bare marker when a value defeats it
 * outright, and a string is not an event. Dropping it is the honest response:
 * we cannot say what it still holds, and a report we cannot vouch for is worth
 * less than no report. See
 * [error-tracking.md](../../../docs/working-notes/ops/error-tracking.md).
 *
 * Its own module rather than living in `instrument.ts` so a test can reach it
 * without importing a file whose whole purpose is a side effect.
 */
export function scrub<T extends object>(payload: T): T | null {
  const scrubbed: unknown = redactSecretsDeep(payload);
  return typeof scrubbed === "object" && scrubbed !== null ? (scrubbed as T) : null;
}
