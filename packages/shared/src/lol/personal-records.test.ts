import { describe, expect, it } from "vitest";
import { isPersonalRecord } from "./personal-records.ts";

describe("isPersonalRecord", () => {
  describe("undefined prior", () => {
    it("does not fire when there is no prior value (higher-better)", () => {
      expect(isPersonalRecord(undefined, 5, "higher-better")).toBe(false);
    });

    it("does not fire when there is no prior value (lower-better)", () => {
      expect(isPersonalRecord(undefined, 5, "lower-better")).toBe(false);
    });
  });

  describe("higher-better", () => {
    it("fires when next strictly exceeds prior", () => {
      expect(isPersonalRecord(3, 4, "higher-better")).toBe(true);
    });

    it("does not fire when next equals prior", () => {
      expect(isPersonalRecord(4, 4, "higher-better")).toBe(false);
    });

    it("does not fire when next is below prior", () => {
      expect(isPersonalRecord(5, 4, "higher-better")).toBe(false);
    });

    it("handles fractional improvements", () => {
      expect(isPersonalRecord(3.5, 3.51, "higher-better")).toBe(true);
    });

    it("handles negative values (prior=-1, next=0)", () => {
      expect(isPersonalRecord(-1, 0, "higher-better")).toBe(true);
    });
  });

  describe("lower-better", () => {
    it("fires when next is strictly below prior", () => {
      expect(isPersonalRecord(1200, 1100, "lower-better")).toBe(true);
    });

    it("does not fire when next equals prior", () => {
      expect(isPersonalRecord(1200, 1200, "lower-better")).toBe(false);
    });

    it("does not fire when next exceeds prior", () => {
      expect(isPersonalRecord(1100, 1200, "lower-better")).toBe(false);
    });
  });

  describe("NaN safety", () => {
    it("does not fire when next is NaN (higher-better)", () => {
      expect(isPersonalRecord(3, Number.NaN, "higher-better")).toBe(false);
    });

    it("does not fire when next is NaN (lower-better)", () => {
      expect(isPersonalRecord(3, Number.NaN, "lower-better")).toBe(false);
    });

    it("does not fire when prior is NaN (higher-better)", () => {
      expect(isPersonalRecord(Number.NaN, 3, "higher-better")).toBe(false);
    });

    it("does not fire when prior is NaN (lower-better)", () => {
      expect(isPersonalRecord(Number.NaN, 3, "lower-better")).toBe(false);
    });
  });

  describe("zero handling", () => {
    it("treats prior=0 as a valid baseline, not as 'no prior' (higher-better)", () => {
      expect(isPersonalRecord(0, 1, "higher-better")).toBe(true);
    });

    it("treats prior=0 as a valid baseline (lower-better, next negative)", () => {
      expect(isPersonalRecord(0, -1, "lower-better")).toBe(true);
    });

    it("does not fire when next=0 equals prior=0", () => {
      expect(isPersonalRecord(0, 0, "higher-better")).toBe(false);
    });
  });
});
