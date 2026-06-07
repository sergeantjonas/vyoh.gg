import { cn } from "@/lib/utils";
import { type PersonalRecordDirection, isPersonalRecord } from "@vyoh/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const STORAGE_PREFIX = "vyoh:pr:";
const FLARE_HOLD_MS = 1800;
const BADGE_HOLD_MS = 5000;

// Records storageKeys we've already detected as new records during this page
// load. React StrictMode mount → unmount → mount cycle would otherwise see the
// just-persisted value as the prior on the second mount, decide isRecord is
// false, and silently drop the flare. By short-circuiting on this set, the
// second mount re-runs the visible fire path without re-reading or re-writing
// localStorage. Module-level so it survives the component's own remount.
const detectedThisPageLoad = new Set<string>();

function readPriorValue(storageKey: string): number | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (raw == null) return undefined;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writePriorValue(storageKey: string, value: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + storageKey, String(value));
  } catch {
    // Quota exceeded or private-mode write rejection — silently drop. The
    // celebration is non-essential and the worst case is a replay on the
    // next visit, never a broken render.
  }
}

export function PersonalRecord({
  storageKey,
  value,
  direction,
  className,
  children,
}: {
  storageKey: string;
  value: number;
  direction: PersonalRecordDirection;
  className?: string;
  children: ReactNode;
}) {
  const [fire, setFire] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    let shouldFire = false;
    if (detectedThisPageLoad.has(storageKey)) {
      // Already detected this record on a prior mount in this page load
      // (typically the first half of React's StrictMode double-mount).
      // Re-display the flare without consulting / mutating storage, so the
      // second mount paints the same celebration the first mount started.
      shouldFire = true;
    } else {
      const prior = readPriorValue(storageKey);
      const isRecord = isPersonalRecord(prior, value, direction);
      // Always persist when there's no prior so future improvements have a
      // baseline to beat. Without this every visit would detect nothing
      // because localStorage stays empty forever.
      if (prior === undefined || isRecord) {
        writePriorValue(storageKey, value);
      }
      if (!isRecord) return;
      detectedThisPageLoad.add(storageKey);
      shouldFire = true;
    }
    if (!shouldFire) return;
    setFire(true);
    setShowBadge(true);
    const fireTimer = setTimeout(() => setFire(false), FLARE_HOLD_MS);
    const badgeTimer = setTimeout(() => setShowBadge(false), BADGE_HOLD_MS);
    return () => {
      clearTimeout(fireTimer);
      clearTimeout(badgeTimer);
    };
  }, [storageKey, value, direction]);

  return (
    <span
      className={cn("pr-flare relative inline-block", className)}
      data-record-fire={fire ? "true" : "false"}
    >
      {children}
      {showBadge && (
        <span
          aria-label="New personal best"
          // Floating superscript per the spec — no chip chrome (background +
          // border made the chip look like it sat in a fog of the flare's own
          // amber halo). Warm amber for legibility against any backdrop,
          // small drop shadow so the type stays readable when the halo
          // beneath it is mid-cycle. Sized so it's clearly readable but
          // small enough to read as a label rather than competing with the
          // number it's annotating.
          className="pointer-events-none absolute -top-3 -right-1 select-none text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300 [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)]"
        >
          ↑ PB
        </span>
      )}
    </span>
  );
}
