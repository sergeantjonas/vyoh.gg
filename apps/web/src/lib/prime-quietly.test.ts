import { describe, expect, it, vi } from "vitest";
import { primeQuietly } from "./prime-quietly";

describe("primeQuietly", () => {
  it("resolves when a prime rejects", async () => {
    await expect(
      primeQuietly(Promise.reject(new Error("upstream")))
    ).resolves.toBeUndefined();
  });

  it("resolves when every prime rejects", async () => {
    await expect(
      primeQuietly(Promise.reject(new Error("a")), Promise.reject(new Error("b")))
    ).resolves.toBeUndefined();
  });

  // The reason this is `allSettled` and not `Promise.all(…).catch()`. Under
  // `all` the loader returns the moment the fast rejection lands, so the slow
  // success is still in flight when the response is serialised and its data
  // never reaches the dehydrated cache.
  it("waits for a slow success even after a fast rejection", async () => {
    const settled = vi.fn();
    const slow = new Promise((resolve) => setTimeout(resolve, 10)).then(settled);

    await primeQuietly(Promise.reject(new Error("fast")), slow);

    expect(settled).toHaveBeenCalled();
  });

  it("resolves with no primes at all", async () => {
    await expect(primeQuietly()).resolves.toBeUndefined();
  });
});
