// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isClientDisconnect } from "./client-disconnect.ts";

describe("isClientDisconnect", () => {
  it("matches the abort React synthesizes when a client drops mid-stream", () => {
    expect(
      isClientDisconnect({
        exception: {
          values: [{ value: "The render was aborted by the server without a reason." }],
        },
      })
    ).toBe(true);
  });

  const prematureClose = (elapsedMs: number) => ({
    exception: { values: [{ value: "Premature close" }] },
    extra: { elapsedMs },
  });

  it("matches the response pipeline closing under a departed client", () => {
    expect(isClientDisconnect(prematureClose(1_200))).toBe(true);
  });

  it("keeps a premature close from a render nginx timed out", () => {
    expect(isClientDisconnect(prematureClose(60_000))).toBe(false);
    expect(
      isClientDisconnect({ exception: { values: [{ value: "Premature close" }] } })
    ).toBe(false);
  });

  it("keeps a premature close that is wrapped or only quoted", () => {
    expect(
      isClientDisconnect({
        exception: {
          values: [{ value: "Premature close" }, { value: "Loader for /lol/x failed" }],
        },
        extra: { elapsedMs: 1_200 },
      })
    ).toBe(false);
    expect(
      isClientDisconnect({
        exception: { values: [{ value: "Premature close while reading body" }] },
        extra: { elapsedMs: 1_200 },
      })
    ).toBe(false);
  });

  it("does not match a real render failure", () => {
    expect(
      isClientDisconnect({
        exception: { values: [{ value: "Cannot read properties of null" }] },
      })
    ).toBe(false);
  });

  it("is safe on an event carrying no exception at all", () => {
    expect(isClientDisconnect({})).toBe(false);
    expect(isClientDisconnect({ exception: { values: [{}] } })).toBe(false);
  });
});
