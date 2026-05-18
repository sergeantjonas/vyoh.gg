import { describe, expect, it } from "vitest";
import { RateLimiterTimeoutError, RiotError } from "./riot.error";

describe("RiotError", () => {
  it("captures message, status, and path", () => {
    const err = new RiotError("Riot upstream 429", 429, "/lol/match/v5/matches/EUW1_1");
    expect(err.message).toBe("Riot upstream 429");
    expect(err.status).toBe(429);
    expect(err.path).toBe("/lol/match/v5/matches/EUW1_1");
    expect(err.name).toBe("RiotError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("RateLimiterTimeoutError", () => {
  it("composes a regional:family path and a synthesized message", () => {
    const err = new RateLimiterTimeoutError("euw1", "match-by-id", 8000);
    expect(err.message).toBe(
      "Rate limiter deadline exceeded after 8000ms on euw1:match-by-id"
    );
    expect(err.path).toBe("euw1:match-by-id");
    expect(err.waitedMs).toBe(8000);
    expect(err.status).toBe(503);
    expect(err.name).toBe("RateLimiterTimeoutError");
  });

  it("is a RiotError subclass (so existing instanceof checks still catch it)", () => {
    const err = new RateLimiterTimeoutError("euw1", "match-by-id", 8000);
    expect(err).toBeInstanceOf(RiotError);
    expect(err).toBeInstanceOf(Error);
  });
});
