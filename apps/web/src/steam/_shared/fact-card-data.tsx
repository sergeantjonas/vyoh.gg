import type { ReactNode } from "react";
import { FactCard } from "./fact-card";

// Render-prop wrapper that owns the pending / error / empty fallback shells
// every Steam fact chip rendered the same three branches before. The success
// branch is delegated to `children(data)` so each chip still picks its own
// underlying card (FactCard for count-based facts; CardShell directly when
// the chip wants a custom indicator slot, e.g. recent-unlocks). The wrapper
// renders FactCard for the fallback shells because every chip in scope uses
// FactCard's count-or-empty visual contract for those branches today.
interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
}

interface FactCardDataProps<T> {
  query: QueryLike<T>;
  title: string;
  /** Verdict during the loading shell. Defaults to `Loading…`. */
  pendingLabel?: string;
  /** Verdict during the error shell. Defaults to `{title} is unavailable right now.` */
  errorLabel?: string;
  /** Verdict when `isEmpty(data)` returns true. Omit to skip the empty branch. */
  emptyLabel?: string;
  /** Optional second line on the empty card, paired with `emptyLabel`. */
  emptyPrescription?: string | undefined;
  /** Predicate run on a non-error, non-pending data payload. Returning true falls through to the empty shell. */
  isEmpty?: (data: T) => boolean;
  /** Success branch. Receives the resolved data and returns the rendered card. */
  children: (data: T) => ReactNode;
}

export function FactCardData<T>({
  query,
  title,
  pendingLabel,
  errorLabel,
  emptyLabel,
  emptyPrescription,
  isEmpty,
  children,
}: FactCardDataProps<T>): ReactNode {
  if (query.isPending) {
    return <FactCard title={title} verdict={pendingLabel ?? "Loading…"} empty />;
  }
  if (query.isError || query.data === undefined) {
    return (
      <FactCard
        title={title}
        verdict={errorLabel ?? `${title} is unavailable right now.`}
        empty
      />
    );
  }
  if (emptyLabel !== undefined && isEmpty?.(query.data) === true) {
    return (
      <FactCard
        title={title}
        verdict={emptyLabel}
        prescription={emptyPrescription}
        empty
      />
    );
  }
  return children(query.data);
}
