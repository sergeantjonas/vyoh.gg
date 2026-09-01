import type { SyncJobStream } from "@vyoh/shared";

export interface SyncJobDefinition {
  stream: SyncJobStream;
  label: string;
  cron: string;
}

/**
 * Every scheduled job in the api, in the order the status board shows them.
 *
 * The cron expression lives here rather than at the `@Cron` decorator so the
 * schedule the board reports and the schedule the scheduler runs cannot drift —
 * each poller passes `SYNC_JOBS[name].cron` straight into its decorator. Order
 * is by cadence, most frequent first, because that is the order the reader
 * scans for "should this have run by now".
 *
 * Adding an entry here is what makes a job addressable: `SyncJobRegistry.run()`
 * is keyed on `SyncJobName`, so a job that isn't listed cannot be recorded.
 */
export const SYNC_JOBS = {
  "steam-player-state": {
    stream: "steam",
    label: "Now playing",
    cron: "*/2 * * * *",
  },
  "steam-owned-games": {
    stream: "steam",
    label: "Owned games",
    cron: "*/15 * * * *",
  },
  "steam-recently-played-unlocks": {
    stream: "steam",
    label: "Recently played unlocks",
    cron: "15 * * * *",
  },
  "steam-player-unlocks": {
    stream: "steam",
    label: "Achievement unlocks",
    cron: "5 */4 * * *",
  },
  "steam-enrichment": {
    stream: "steam",
    label: "Store enrichment",
    cron: "30 4 * * *",
  },
  "steam-achievement-schema": {
    stream: "steam",
    label: "Achievement schemas",
    cron: "0 5 * * *",
  },
  "steam-global-rarity": {
    stream: "steam",
    label: "Global rarity",
    cron: "30 5 * * *",
  },
  "steam-tag-catalog": {
    stream: "steam",
    label: "Tag catalog",
    cron: "45 4 1 * *",
  },
} as const satisfies Record<string, SyncJobDefinition>;

export type SyncJobName = keyof typeof SYNC_JOBS;
