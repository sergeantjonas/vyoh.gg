import { describe, expect, it } from "vitest";
import { type SyncJobRun, type SyncJobStatus, syncJobHealth } from "./status.ts";

function job(overrides: Partial<SyncJobStatus> = {}): SyncJobStatus {
  return {
    name: "steam-owned-games",
    stream: "steam",
    label: "Owned games",
    cron: "*/15 * * * *",
    running: false,
    lastRun: null,
    ...overrides,
  };
}

function run(overrides: Partial<SyncJobRun> = {}): SyncJobRun {
  return {
    startedAt: "2026-09-02T04:00:00.000Z",
    finishedAt: "2026-09-02T04:00:01.000Z",
    durationMs: 1_000,
    outcome: "ok",
    ...overrides,
  };
}

describe("syncJobHealth", () => {
  it("is pending for a job that has never completed a run", () => {
    expect(syncJobHealth(job())).toBe("pending");
  });

  it("is ok after a successful run", () => {
    expect(syncJobHealth(job({ lastRun: run() }))).toBe("ok");
  });

  it("is error after a failed run", () => {
    expect(syncJobHealth(job({ lastRun: run({ outcome: "error" }) }))).toBe("error");
  });

  // Running wins over the recorded outcome: a job retrying right now is more
  // useful to see as in-flight than as whatever it did last time.
  it("is running while in flight, even after a failure", () => {
    expect(
      syncJobHealth(job({ running: true, lastRun: run({ outcome: "error" }) }))
    ).toBe("running");
  });

  it("is running for a first-ever run with no recorded outcome", () => {
    expect(syncJobHealth(job({ running: true }))).toBe("running");
  });
});
