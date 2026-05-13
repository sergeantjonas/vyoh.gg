import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getResolvedSplash, resolveSplash } from "./splash-resolver";

// happy-dom's Image never fires onload/onerror because it doesn't run a network
// stack, so we replace the constructor with a stub the test can drive directly.
class StubImage {
  static instances: StubImage[] = [];
  static srcLog: string[] = [];
  static reset(): void {
    StubImage.instances = [];
    StubImage.srcLog = [];
  }
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = "";
  get src(): string {
    return this.#src;
  }
  set src(value: string) {
    this.#src = value;
    StubImage.srcLog.push(value);
    StubImage.instances.push(this);
  }
}

describe("resolveSplash", () => {
  let originalImage: typeof Image;

  beforeEach(() => {
    originalImage = globalThis.Image;
    StubImage.reset();
    // The DOM Image type is structurally richer than we need for probing;
    // probe() only touches src/onload/onerror.
    globalThis.Image = StubImage as unknown as typeof Image;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.Image = originalImage;
  });

  it("falls through to the last candidate when every probe times out", async () => {
    const promise = resolveSplash("test-all-timeout", ["url-a", "url-b", "url-c"], 100);

    // Each candidate's timeout fires sequentially.
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    expect(await promise).toBe("url-c");
    // Probes ran in order, one at a time — not in parallel.
    expect(StubImage.srcLog).toEqual(["url-a", "url-b", "url-c"]);
    // Result is cached for subsequent callers.
    expect(getResolvedSplash("test-all-timeout")).toBe("url-c");
  });

  it("returns the first candidate that loads before its timeout", async () => {
    const promise = resolveSplash("test-first-loads", ["good", "bad"], 100);

    // Let the async resolver create the first probe Image.
    await Promise.resolve();
    const first = StubImage.instances[0];
    expect(first).toBeDefined();
    first?.onload?.();

    expect(await promise).toBe("good");
    // Second candidate is never probed once the first wins.
    expect(StubImage.srcLog).toEqual(["good"]);
  });

  it("skips a failing candidate and resolves the next one", async () => {
    const promise = resolveSplash("test-error-then-load", ["broken", "fallback"], 100);

    await Promise.resolve();
    StubImage.instances[0]?.onerror?.();
    await Promise.resolve();
    StubImage.instances[1]?.onload?.();

    expect(await promise).toBe("fallback");
    expect(StubImage.srcLog).toEqual(["broken", "fallback"]);
  });
});
