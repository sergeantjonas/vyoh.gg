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
  { id: 710, label: "Ranked 5s" },
  { id: 400, label: "Normal Draft" },
];

// Baseline: ranked solo + flex. Users can include normal draft or the premade
// 5s ladder, or exclude flex, via the SeriousQueuesSettings popover in the
// account header. 710 is off by default despite carrying LP — a five-stack
// ladder measures the stack, so folding it into the baseline would move every
// solo statistic on the page without the owner asking.
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
  // Seeded with the defaults rather than with `readPersisted()`, because a lazy
  // initialiser runs during render — the server would seed the defaults and the
  // client's hydrating render would seed whatever localStorage holds, and any
  // owner who has customised the selection would hydrate against markup built
  // from a different queue set. The adopt-persisted effect below closes that by
  // one commit. This only ever fired for a customised selection, which is why
  // it survives an empty-storage smoke test.
  const [ids, setIds] = useState<number[]>(() => [...DEFAULT_SERIOUS_QUEUE_IDS]);

  useEffect(() => {
    const persisted = readPersisted();
    setIds((current) =>
      persisted.length === current.length && persisted.every((id, i) => id === current[i])
        ? current
        : persisted
    );
  }, []);

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

// Compares ids directly, and must keep doing so. Every statistic in the app
// flows through here, so routing the decision through a rendered name would
// make all of them depend on the label above agreeing with the canonical one
// in QUEUE_TYPES — and a rename there would empty the intersection silently,
// dropping that queue from every analysis surface without an error.
//
// The allowlist is also what keeps customs and unrecognised queues out of
// statistics: nothing enters without being named in CONFIGURABLE_SERIOUS_QUEUES,
// so a queue Riot ships mid-season is excluded by default rather than by a rule
// someone has to remember to write.
export function filterToSerious(
  matches: MatchSummary[],
  ids: ReadonlySet<number>
): MatchSummary[] {
  return matches.filter((m) => ids.has(m.queueId));
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
