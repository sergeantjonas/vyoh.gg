export interface QueueOption {
  id: number | undefined;
  label: string;
}

export const QUEUE_OPTIONS: readonly QueueOption[] = [
  { id: undefined, label: "All matches" },
  { id: 420, label: "Ranked Solo" },
  { id: 440, label: "Ranked Flex" },
  { id: 450, label: "ARAM" },
  { id: 490, label: "Quickplay" },
  { id: 400, label: "Normal Draft" },
  { id: 1700, label: "Arena" },
  { id: 1840, label: "Swarm" },
];
