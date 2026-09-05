import type { SyncJobStream } from "@vyoh/shared";

export interface SyncJobDefinition {
  stream: SyncJobStream;
  label: string;
  // Null for an on-demand job: it has no `@Cron` handler, only a trigger.
  cron: string | null;
}

/**
 * Every scheduled job in the api, in the order the status board shows them.
 *
 * The cron expression lives here rather than at the `@Cron` decorator so the
 * schedule the board reports and the schedule the scheduler runs cannot drift —
 * each caller passes `SYNC_JOBS[name].cron` straight into its decorator. Jobs
 * are grouped by stream, since that is how the board splits them into cards,
 * and ordered within a stream by cadence, most frequent first — the order a
 * reader scans for "should this have run by now".
 *
 * Adding an entry here is what makes a job addressable: `SyncJobRegistry.run()`
 * is keyed on `SyncJobName`, so a job that isn't listed cannot be recorded.
 * On-demand jobs sit last in their stream, after every cadence.
 */
export const SYNC_JOBS = {
  "lol-patch-notes": {
    stream: "lol",
    label: "Patch notes",
    cron: "0 */6 * * *",
  },
  "lol-static-data": {
    stream: "lol",
    label: "Static data",
    cron: "5 */6 * * *",
  },
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
  "steam-game-refresh": {
    stream: "steam",
    label: "Per-game refresh",
    cron: null,
  },
} as const satisfies Record<string, SyncJobDefinition>;

export type SyncJobName = keyof typeof SYNC_JOBS;
