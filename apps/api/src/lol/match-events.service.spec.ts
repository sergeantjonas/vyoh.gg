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
