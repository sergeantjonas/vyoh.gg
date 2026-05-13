// Module-scope splash URL resolver.
//
// Background: wsrv.nl returns inconsistent responses for the same upstream
// CDragon URL across near-simultaneous requests (some succeed, some 404 or
// 502). When N cards for the same champion render at once, each card
// independently rolls the dice and runs its own onError fallback chain —
// producing the "some load, some don't" inconsistency observed in the wild.
//
// Solution: resolve the URL once per champion via an in-memory probe
// (new Image()), cache the result, and dedupe in-flight resolutions so
// concurrent callers share the same Promise. Subsequent renders (and
// concurrent siblings) use the resolved URL directly — no per-card chain.

// Phase 0 image-pipeline: a hung wsrv.nl connection used to block the entire
// fallback chain because the probe had no timeout. Each candidate now races a
// `timeoutMs` budget, so the worst-case wait is bounded by
// `candidates.length * timeoutMs`. See docs/working-notes/lol-image-pipeline.md.
const DEFAULT_PROBE_TIMEOUT_MS = 2000;

const resolved = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function probe(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    img.onload = () => settle(true);
    img.onerror = () => settle(false);
    img.src = url;
  });
}

export function getResolvedSplash(key: string): string | undefined {
  return resolved.get(key);
}

export function resolveSplash(
  key: string,
  candidates: string[],
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS
): Promise<string> {
  const cached = resolved.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    // Even if every probe fails, fall through to the last candidate so the
    // <img> renders something rather than staying blank forever.
    let result = candidates[candidates.length - 1] ?? "";
    for (const url of candidates) {
      if (await probe(url, timeoutMs)) {
        result = url;
        break;
      }
    }
    resolved.set(key, result);
    pending.delete(key);
    return result;
  })();

  pending.set(key, promise);
  return promise;
}
