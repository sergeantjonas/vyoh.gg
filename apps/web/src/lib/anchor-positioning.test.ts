import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCSS = globalThis.CSS;

describe("ensureAnchorPositioning", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@oddbird/css-anchor-positioning/fn");
    globalThis.CSS = originalCSS;
  });

  it("returns 'native' when the engine supports anchor-name", async () => {
    globalThis.CSS = {
      supports: (property: string, value: string) =>
        property === "anchor-name" && value === "--x",
    } as unknown as typeof CSS;

    const { ensureAnchorPositioning } = await import("./anchor-positioning");
    await expect(ensureAnchorPositioning()).resolves.toBe("native");
  });

  it("loads and applies the polyfill when native support is missing", async () => {
    globalThis.CSS = {
      supports: () => false,
    } as unknown as typeof CSS;

    const polyfill = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@oddbird/css-anchor-positioning/fn", () => ({
      default: polyfill,
    }));

    const { ensureAnchorPositioning } = await import("./anchor-positioning");
    await expect(ensureAnchorPositioning()).resolves.toBe("polyfill");
    expect(polyfill).toHaveBeenCalledOnce();
  });

  it("returns 'unavailable' when the polyfill import rejects", async () => {
    globalThis.CSS = {
      supports: () => false,
    } as unknown as typeof CSS;

    vi.doMock("@oddbird/css-anchor-positioning/fn", () => {
      throw new Error("module not found");
    });

    const { ensureAnchorPositioning } = await import("./anchor-positioning");
    await expect(ensureAnchorPositioning()).resolves.toBe("unavailable");
  });

  it("returns 'unavailable' when the polyfill apply rejects", async () => {
    globalThis.CSS = {
      supports: () => false,
    } as unknown as typeof CSS;

    vi.doMock("@oddbird/css-anchor-positioning/fn", () => ({
      default: () => Promise.reject(new Error("apply failed")),
    }));

    const { ensureAnchorPositioning } = await import("./anchor-positioning");
    await expect(ensureAnchorPositioning()).resolves.toBe("unavailable");
  });

  it("memoises the result across repeated calls", async () => {
    globalThis.CSS = {
      supports: () => false,
    } as unknown as typeof CSS;

    const polyfill = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@oddbird/css-anchor-positioning/fn", () => ({
      default: polyfill,
    }));

    const { ensureAnchorPositioning } = await import("./anchor-positioning");
    const first = ensureAnchorPositioning();
    const second = ensureAnchorPositioning();
    expect(first).toBe(second);
    await first;
    expect(polyfill).toHaveBeenCalledOnce();
  });
});
