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
