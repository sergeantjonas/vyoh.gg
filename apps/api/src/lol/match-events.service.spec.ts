import { describe, expect, it } from "vitest";
import { MatchEventsService } from "./match-events.service";

describe("MatchEventsService", () => {
  it("forwards emitted events to subscribers filtered by puuid", () => {
    const service = new MatchEventsService();
    const received: Array<{ puuid: string; added: number }> = [];

    const sub = service.forPuuid("puuid-A").subscribe((event) => {
      received.push({ puuid: event.puuid, added: event.added });
    });

    service.emit({ puuid: "puuid-A", added: 3, source: "head" });
    service.emit({ puuid: "puuid-B", added: 5, source: "historical" });
    service.emit({ puuid: "puuid-A", added: 1, source: "historical" });

    sub.unsubscribe();

    expect(received).toEqual([
      { puuid: "puuid-A", added: 3 },
      { puuid: "puuid-A", added: 1 },
    ]);
  });

  it("forwards live-game events to subscribers filtered by puuid", () => {
    const service = new MatchEventsService();
    const received: Array<{ type: string; puuid: string }> = [];
    const sub = service
      .forLiveGame("puuid-A")
      .subscribe((e) => received.push({ type: e.type, puuid: e.puuid }));
    service.emitLiveGame({ type: "game-started", puuid: "puuid-A" });
    service.emitLiveGame({ type: "game-started", puuid: "puuid-OTHER" });
    service.emitLiveGame({ type: "game-ended", puuid: "puuid-A" });
    sub.unsubscribe();
    expect(received).toEqual([
      { type: "game-started", puuid: "puuid-A" },
      { type: "game-ended", puuid: "puuid-A" },
    ]);
  });

  it("forwards sync-tick events to every subscriber (no puuid filter)", () => {
    const service = new MatchEventsService();
    const received: number[] = [];
    const sub = service.forSyncTick().subscribe((t) => received.push(t.durationMs));
    service.emitSyncTick({
      startedAt: "2026-05-19T10:00:00.000Z",
      finishedAt: "2026-05-19T10:00:01.000Z",
      durationMs: 1000,
      accounts: [],
    });
    service.emitSyncTick({
      startedAt: "2026-05-19T10:00:05.000Z",
      finishedAt: "2026-05-19T10:00:06.000Z",
      durationMs: 1500,
      accounts: [],
    });
    sub.unsubscribe();
    expect(received).toEqual([1000, 1500]);
  });

  it("only delivers events emitted while the subscription is active", () => {
    const service = new MatchEventsService();
    const received: number[] = [];

    // Pre-subscribe emission — should not appear.
    service.emit({ puuid: "puuid-A", added: 99, source: "head" });

    const sub = service.forPuuid("puuid-A").subscribe((event) => {
      received.push(event.added);
    });

    service.emit({ puuid: "puuid-A", added: 1, source: "head" });
    sub.unsubscribe();

    // Post-unsubscribe emission — should not appear.
    service.emit({ puuid: "puuid-A", added: 2, source: "head" });

    expect(received).toEqual([1]);
  });
});
