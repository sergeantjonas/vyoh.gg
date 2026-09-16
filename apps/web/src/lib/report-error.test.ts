import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportError } from "./report-error";

// The real module calls `Sentry.init` at import, which installs global handlers
// a test suite should not inherit — the same reason `early-errors.ts` is split
// out of it.
// `tsconfig.app.json` pins `types: ["vite/client"]` so Node globals cannot leak
// into browser code; the one field this test needs is declared here instead,
// the same way `lib/api-url.ts` does it.
declare const process: {
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
};

const captureAppError = vi.hoisted(() => vi.fn());
vi.mock("../instrument", () => ({ captureAppError }));

describe("reportError", () => {
  beforeEach(() => {
    captureAppError.mockClear();
  });

  it("forwards the error and its tier to the lazily-loaded reporter", async () => {
    const boom = new Error("mutation failed");

    reportError(boom, "mutation");
    // The import is dynamic, so the call lands a microtask later.
    await vi.waitFor(() =>
      expect(captureAppError).toHaveBeenCalledWith(boom, "mutation")
    );
  });

  it("reports a non-Error value rather than dropping it", async () => {
    reportError("a thrown string", "widget");

    await vi.waitFor(() =>
      expect(captureAppError).toHaveBeenCalledWith("a thrown string", "widget")
    );
  });

  // The caller is an error path already; a failed reporter must not add a
  // second, unhandled rejection on top of the failure being reported. Asserting
  // `not.toThrow()` would pass vacuously — `reportError` is synchronous and
  // ends in `void import(...)`, which cannot throw synchronously — so the
  // rejection is what has to be observed.
  it("swallows a failed reporter chunk instead of rejecting unhandled", async () => {
    vi.doMock("../instrument", () => {
      throw new Error("chunk 404");
    });
    vi.resetModules();
    const { reportError: fresh } = await import("./report-error");
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    try {
      fresh(new Error("x"), "route");
      // A macrotask, so a rejection settled in a microtask has already fired.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
