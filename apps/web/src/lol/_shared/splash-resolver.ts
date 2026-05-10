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

const resolved = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function getResolvedSplash(key: string): string | undefined {
  return resolved.get(key);
}

export function resolveSplash(key: string, candidates: string[]): Promise<string> {
  const cached = resolved.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    // Even if every probe fails, fall through to the last candidate so the
    // <img> renders something rather than staying blank forever.
    let result = candidates[candidates.length - 1] ?? "";
    for (const url of candidates) {
      if (await probe(url)) {
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
