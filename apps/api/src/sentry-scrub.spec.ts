import { describe, expect, it } from "vitest";
import { scrub } from "./sentry-scrub";

describe("scrub", () => {
  it("redacts secrets anywhere in an event", () => {
    const event = {
      message: "GET https://api.steampowered.com/x?key=LIVE failed",
      extra: { headers: { authorization: "Bearer LIVE" } },
    };
    expect(scrub(event)).toEqual({
      message: "GET https://api.steampowered.com/x?key=*** failed",
      extra: { headers: { authorization: "***" } },
    });
  });

  it("drops the payload when the scrubber collapses it to the marker", () => {
    // A proxy that throws from `ownKeys` defeats the walk entirely, and the
    // scrubber answers with the bare marker. A string is not an event, and
    // sending one we cannot vouch for is worse than sending nothing.
    const hostile = new Proxy(
      { ok: 1 },
      {
        ownKeys() {
          throw new Error("nope");
        },
      }
    );
    expect(scrub(hostile)).toBeNull();
  });
});
