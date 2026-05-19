import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSpy = vi.fn();
const errorSpy = vi.fn();
const successSpy = vi.fn();
const infoSpy = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(toastSpy, {
    error: errorSpy,
    success: successSpy,
    info: infoSpy,
  }),
}));

beforeEach(() => {
  toastSpy.mockClear();
  errorSpy.mockClear();
  successSpy.mockClear();
  infoSpy.mockClear();
});

afterEach(() => {
  // Reset the module-level `cached` between tests so each one re-evaluates the
  // dynamic import path.
  vi.resetModules();
});

describe("toast helpers", () => {
  it("toastMessage forwards to sonner.toast with the message and options", async () => {
    const { toastMessage } = await import("./toast");
    await toastMessage("hello", { duration: 100 });
    expect(toastSpy).toHaveBeenCalledWith("hello", { duration: 100 });
  });

  it("toastError forwards to sonner.toast.error", async () => {
    const { toastError } = await import("./toast");
    await toastError("oops");
    expect(errorSpy).toHaveBeenCalledWith("oops", undefined);
  });

  it("toastSuccess forwards to sonner.toast.success", async () => {
    const { toastSuccess } = await import("./toast");
    await toastSuccess("nice");
    expect(successSpy).toHaveBeenCalledWith("nice", undefined);
  });

  it("toastInfo forwards to sonner.toast.info", async () => {
    const { toastInfo } = await import("./toast");
    await toastInfo("fyi");
    expect(infoSpy).toHaveBeenCalledWith("fyi", undefined);
  });

  it("dedupes the dynamic import — second call reuses the cached sonner module", async () => {
    const { toastMessage } = await import("./toast");
    await toastMessage("first");
    await toastMessage("second");
    expect(toastSpy).toHaveBeenCalledTimes(2);
  });
});
