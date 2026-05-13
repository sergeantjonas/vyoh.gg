import { useEffect, useRef, useState } from "react";

const NOTICE_TTL_MS = 6000;

/**
 * Watches the latest matchId in a window. When it transitions from one
 * non-null value to a different one (i.e. a new match has been prepended by
 * the SSE invalidation flow), returns `true` for `NOTICE_TTL_MS` then resets.
 *
 * The first transition (undefined → first matchId) is suppressed so an
 * initial profile load doesn't fire a notice. The mount-time match is the
 * existing state, not "just arrived."
 */
export function useNewMatchNotice(latestMatchId: string | undefined): boolean {
  const [isFresh, setIsFresh] = useState(false);
  const prevRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = latestMatchId;
    if (!latestMatchId) return;
    if (prev === undefined) return;
    if (prev === latestMatchId) return;
    setIsFresh(true);
    const tid = window.setTimeout(() => setIsFresh(false), NOTICE_TTL_MS);
    return () => window.clearTimeout(tid);
  }, [latestMatchId]);

  return isFresh;
}
