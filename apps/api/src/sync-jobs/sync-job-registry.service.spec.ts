import { describe, expect, it, vi } from "vitest";
import { SyncJobRegistry } from "./sync-job-registry.service";
import { SYNC_JOBS } from "./sync-jobs.catalog";

const JOB = "steam-owned-games";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("SyncJobRegistry", () => {
  it("reports every catalogued job as pending before anything has run", () => {
    const status = new SyncJobRegistry().getStatus();

    expect(status).toHaveLength(Object.keys(SYNC_JOBS).length);
    expect(status.every((job) => job.lastRun === null && !job.running)).toBe(true);
    expect(status.map((job) => job.name)).toEqual(Object.keys(SYNC_JOBS));
  });

  it("carries the catalogued label, stream and cron onto the status row", () => {
    const job = new SyncJobRegistry().getStatus().find((j) => j.name === JOB);

    expect(job).toMatchObject({
      stream: SYNC_JOBS[JOB].stream,
      label: SYNC_JOBS[JOB].label,
      cron: SYNC_JOBS[JOB].cron,
    });
  });

  it("records a successful run with its duration", async () => {
    const registry = new SyncJobRegistry();

    await expect(registry.run(JOB, async () => {})).resolves.toBe(true);

    const { lastRun, running } = statusFor(registry, JOB);
    expect(running).toBe(false);
    expect(lastRun?.outcome).toBe("ok");
    expect(lastRun?.error).toBeUndefined();
    expect(lastRun?.durationMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(lastRun?.finishedAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(lastRun?.startedAt ?? "")
    );
  });

  // The cron handler must not see the rejection: `@nestjs/schedule` has nowhere
  // to put it, and a job whose failures escape is exactly the job the board is
  // supposed to be reporting on.
  it("swallows a failure and records it as the last outcome", async () => {
    const registry = new SyncJobRegistry();

    await expect(
      registry.run(JOB, () => Promise.reject(new Error("steam down")))
    ).resolves.toBe(true);

    expect(statusFor(registry, JOB).lastRun).toMatchObject({
      outcome: "error",
      error: "steam down",
    });
  });

  it("redacts credentials out of an error message", async () => {
    const registry = new SyncJobRegistry();

    await registry.run(JOB, () =>
      Promise.reject(
        new Error("GET https://api.steampowered.com/x?key=DEADBEEF&steamid=7 → 403")
      )
    );

    const message = statusFor(registry, JOB).lastRun?.error ?? "";
    expect(message).not.toContain("DEADBEEF");
    expect(message).toContain("key=***");
    expect(message).toContain("steamid=7");
  });

  it("reports a job as running for the duration of its work", async () => {
    const registry = new SyncJobRegistry();
    const gate = deferred();

    const run = registry.run(JOB, () => gate.promise);
    expect(statusFor(registry, JOB).running).toBe(true);

    gate.resolve();
    await run;
    expect(statusFor(registry, JOB).running).toBe(false);
  });

  it("skips a second run while the first is still in flight", async () => {
    const registry = new SyncJobRegistry();
    const gate = deferred();
    const work = vi.fn().mockReturnValueOnce(gate.promise);

    const first = registry.run(JOB, work);
    await expect(registry.run(JOB, work)).resolves.toBe(false);
    expect(work).toHaveBeenCalledOnce();

    gate.resolve();
    await first;

    // The skip must not leave the job wedged — the next tick runs normally.
    await expect(registry.run(JOB, async () => {})).resolves.toBe(true);
  });

  it("trigger() starts the work and reports the job as already running", () => {
    const registry = new SyncJobRegistry();
    const gate = deferred();
    const work = vi.fn().mockReturnValue(gate.promise);

    const result = registry.trigger(JOB, work);

    expect(result.triggered).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(work).toHaveBeenCalledOnce();
    // The caller must not have to wait for the run: the response carries the
    // state the trigger just produced, not the state before it.
    expect(result.job.running).toBe(true);

    gate.resolve();
  });

  it("trigger() refuses rather than queueing when the job is mid-run", () => {
    const registry = new SyncJobRegistry();
    const gate = deferred();
    const work = vi.fn().mockReturnValue(gate.promise);

    registry.trigger(JOB, work);
    const second = registry.trigger(JOB, work);

    expect(second).toMatchObject({ triggered: false, reason: "already running" });
    expect(work).toHaveBeenCalledOnce();

    gate.resolve();
  });

  // A manual trigger reaches the registry from an HTTP handler that returns
  // before the work finishes, so a rejection has nothing to catch it.
  it("trigger() does not reject when the work fails", async () => {
    const registry = new SyncJobRegistry();

    expect(registry.trigger(JOB, () => Promise.reject(new Error("boom")))).toMatchObject({
      triggered: true,
    });
    await vi.waitFor(() => {
      expect(statusFor(registry, JOB).lastRun).toMatchObject({ outcome: "error" });
    });
  });

  it("records a triggered run the same way a scheduled one is recorded", async () => {
    const registry = new SyncJobRegistry();

    registry.trigger(JOB, async () => {});
    await vi.waitFor(() => {
      expect(statusFor(registry, JOB).lastRun?.outcome).toBe("ok");
    });
    expect(statusFor(registry, JOB).running).toBe(false);
  });

  it("keeps each job's overlap guard to itself", async () => {
    const registry = new SyncJobRegistry();
    const gate = deferred();

    const first = registry.run(JOB, () => gate.promise);
    await expect(registry.run("steam-player-state", async () => {})).resolves.toBe(true);

    gate.resolve();
    await first;
  });
});

function statusFor(registry: SyncJobRegistry, name: string) {
  const job = registry.getStatus().find((j) => j.name === name);
  if (!job) throw new Error(`no status row for ${name}`);
  return job;
}
