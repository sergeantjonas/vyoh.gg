import { describe, expect, it } from "vitest";
import { HttpError } from "./http-error";

describe("HttpError", () => {
  it("preserves the explicit message when one is passed", () => {
    const err = new HttpError(404, "Not Found");
    expect(err.message).toBe("Not Found");
    expect(err.status).toBe(404);
    expect(err.name).toBe("HttpError");
  });

  it("falls back to a generic 'HTTP <status>' message", () => {
    const err = new HttpError(500);
    expect(err.message).toBe("HTTP 500");
  });

  it("is an Error instance (so try/catch and instanceof still work)", () => {
    expect(new HttpError(400)).toBeInstanceOf(Error);
  });
});
