import { describe, expect, it } from "vitest";

import { parseAnimatableNumber } from "./parse-animatable-number";

describe("parseAnimatableNumber", () => {
  it("parses a bare integer", () => {
    expect(parseAnimatableNumber("76")).toEqual({
      raw: 76,
      decimals: 0,
      suffix: "",
    });
  });

  it("parses a percentage and preserves the suffix", () => {
    expect(parseAnimatableNumber("55%")).toEqual({
      raw: 55,
      decimals: 0,
      suffix: "%",
    });
  });

  it("parses a decimal and counts the digits after the dot", () => {
    expect(parseAnimatableNumber("3.22")).toEqual({
      raw: 3.22,
      decimals: 2,
      suffix: "",
    });
  });

  it("parses a number followed by a space-separated unit word", () => {
    // PeakChip emits "3 games" / "1 game"; both should animate the digit
    // while the unit stays static.
    expect(parseAnimatableNumber("3 games")).toEqual({
      raw: 3,
      decimals: 0,
      suffix: " games",
    });
    expect(parseAnimatableNumber("1 game")).toEqual({
      raw: 1,
      decimals: 0,
      suffix: " game",
    });
  });

  it("returns null for compound numeric shapes like KDA scores", () => {
    // Animating just the leading "24" would silently change the meaning of
    // the displayed value — fall through to a static render instead.
    expect(parseAnimatableNumber("24/7/14")).toBeNull();
  });

  it("returns null for the em-dash placeholder used in empty states", () => {
    expect(parseAnimatableNumber("—")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseAnimatableNumber("Aggressive")).toBeNull();
    expect(parseAnimatableNumber("")).toBeNull();
  });
});
