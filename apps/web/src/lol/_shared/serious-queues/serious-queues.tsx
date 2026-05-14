import { useMatchWindow } from "@/lol/matches/match-window-context";
import type { MatchSummary } from "@vyoh/shared";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface ConfigurableSeriousQueue {
  id: number;
  label: string;
}

// The set of queues users can opt into for performance metrics. Anything
// outside this list is excluded by definition (ARAM, Arena, Swarm, Quickplay
// — too low-stakes or random for a meaningful read).
export const CONFIGURABLE_SERIOUS_QUEUES: readonly ConfigurableSeriousQueue[] = [
  { id: 420, label: "Ranked Solo" },
  { id: 440, label: "Ranked Flex" },
  { id: 400, label: "Normal Draft" },
];

// Baseline: ranked solo + flex. Users can include normal draft or exclude
// flex via the SeriousQueuesSettings popover in the account header.
export const DEFAULT_SERIOUS_QUEUE_IDS: readonly number[] = [420, 440];

const STORAGE_KEY = "vyoh:serious-queues";

interface SeriousQueuesValue {
  ids: ReadonlySet<number>;
  set: (next: readonly number[]) => void;
}

const SeriousQueuesContext = createContext<SeriousQueuesValue | null>(null);

function readPersisted(): number[] {
  if (typeof window === "undefined") return [...DEFAULT_SERIOUS_QUEUE_IDS];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SERIOUS_QUEUE_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SERIOUS_QUEUE_IDS];
    const numeric = parsed.filter((v) => typeof v === "number");
    return numeric.length === 0 ? [...DEFAULT_SERIOUS_QUEUE_IDS] : numeric;
  } catch {
    return [...DEFAULT_SERIOUS_QUEUE_IDS];
  }
}

export function SeriousQueuesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<number[]>(() => readPersisted());

  const set = useCallback((next: readonly number[]) => {
    const arr = [...next].filter((id) =>
      CONFIGURABLE_SERIOUS_QUEUES.some((q) => q.id === id)
    );
    setIds(arr);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // localStorage can be blocked (private mode, quota) — keep the in-memory
      // state and silently drop persistence rather than failing the toggle.
    }
  }, []);

  // Sync across tabs / windows so a change in one tab updates others.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setIds(readPersisted());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<SeriousQueuesValue>(
    () => ({ ids: new Set(ids), set }),
    [ids, set]
  );

  return (
    <SeriousQueuesContext.Provider value={value}>
      {children}
    </SeriousQueuesContext.Provider>
  );
}

export function useSeriousQueues(): SeriousQueuesValue {
  const ctx = useContext(SeriousQueuesContext);
  if (!ctx) {
    throw new Error("useSeriousQueues must be used inside SeriousQueuesProvider");
  }
  return ctx;
}

const SERIOUS_LABELS_BY_ID = new Map(
  CONFIGURABLE_SERIOUS_QUEUES.map((q) => [q.id, q.label] as const)
);

function selectedLabels(ids: ReadonlySet<number>): Set<string> {
  const labels = new Set<string>();
  for (const id of ids) {
    const label = SERIOUS_LABELS_BY_ID.get(id);
    if (label) labels.add(label);
  }
  return labels;
}

export function filterToSerious(
  matches: MatchSummary[],
  ids: ReadonlySet<number>
): MatchSummary[] {
  const labels = selectedLabels(ids);
  return matches.filter((m) => labels.has(m.queueType));
}

/**
 * Returns the user's recent matches filtered to the queues currently flagged
 * "serious" by their preferences. Use this from analysis surfaces (Trends,
 * Pre-game ritual, Champions, Recap headline insight). For identity / cadence
 * surfaces (Recent form, Now playing, Queue distribution, Activity calendar,
 * Stats bar, Duos) consume `useMatchWindow` directly so all queues are shown.
 */
export function useSeriousMatches(): {
  matches: MatchSummary[] | undefined;
  isPending: boolean;
} {
  const { matches, isPending } = useMatchWindow();
  const { ids } = useSeriousQueues();
  const filtered = useMemo(() => {
    if (!matches) return undefined;
    return filterToSerious(matches, ids);
  }, [matches, ids]);
  return { matches: filtered, isPending };
}
