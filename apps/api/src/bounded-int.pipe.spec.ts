import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { BoundedIntPipe, COUNT_PIPE, QUEUE_PIPE_OPTIONAL } from "./bounded-int.pipe";

describe("BoundedIntPipe", () => {
  const pipe = new BoundedIntPipe("count", 0, 100);

  it("passes an in-range integer through", () => {
    expect(pipe.transform("42")).toBe(42);
    expect(pipe.transform(42)).toBe(42);
  });

  it("accepts both ends of the range", () => {
    expect(pipe.transform("0")).toBe(0);
    expect(pipe.transform("100")).toBe(100);
  });

  // Prisma reads a negative `take` as "take the last N" rather than erroring,
  // so this silently reversed pagination instead of failing.
  it("rejects a negative value", () => {
    expect(() => pipe.transform("-1")).toThrow(BadRequestException);
  });

  it("rejects a value past the ceiling", () => {
    expect(() => pipe.transform("101")).toThrow(BadRequestException);
    expect(() => pipe.transform("999999999")).toThrow(BadRequestException);
  });

  it("rejects non-integers", () => {
    for (const bad of ["", "abc", "1.5", "NaN", "Infinity", "0x10"]) {
      expect(() => pipe.transform(bad), `should reject ${JSON.stringify(bad)}`).toThrow(
        BadRequestException
      );
    }
  });

  // A repeated query param arrives as an array. Coercing it would turn
  // `?count=1&count=2` into something arbitrary rather than an error.
  it("rejects an array, as a repeated query param produces", () => {
    expect(() => pipe.transform(["1", "2"])).toThrow(BadRequestException);
    expect(() => pipe.transform({ a: 1 })).toThrow(BadRequestException);
  });

  it("passes undefined through only when optional", () => {
    expect(QUEUE_PIPE_OPTIONAL.transform(undefined)).toBeUndefined();
    expect(QUEUE_PIPE_OPTIONAL.transform("")).toBeUndefined();
    expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
  });

  // Both bounds are pinned by real callers rather than chosen for neatness:
  // the champion table, champion detail and activity window each request 2000
  // matches, and two web call sites send count=0. A ceiling under 2000 would
  // not error — it would aggregate a truncated window and report a wrong
  // number — and a floor of 1 would break the zero case.
  it("admits the counts the web actually sends", () => {
    expect(COUNT_PIPE.transform("2000")).toBe(2000);
    expect(COUNT_PIPE.transform("0")).toBe(0);
    expect(COUNT_PIPE.transform("500")).toBe(500);
  });
});
