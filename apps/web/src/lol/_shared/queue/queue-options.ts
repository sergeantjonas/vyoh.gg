import { QUEUE_TYPES } from "@vyoh/shared";

export interface QueueOption {
  id: number | undefined;
  label: string;
}

// Curated subset of the canonical QUEUE_TYPES map — only the queues we
// surface in the match-history filter UI. Order is roughly "most-played for
// this owner first" rather than queue id. Pulling labels from the shared
// canonical map keeps the dropdown in sync with the rest of the LoL surface.
const FILTER_QUEUE_IDS: readonly number[] = [420, 440, 450, 490, 400, 1700, 1840];

export const QUEUE_OPTIONS: readonly QueueOption[] = [
  { id: undefined, label: "All matches" },
  ...FILTER_QUEUE_IDS.map((id) => ({
    id,
    label: QUEUE_TYPES[id] ?? `Queue ${id}`,
  })),
];
