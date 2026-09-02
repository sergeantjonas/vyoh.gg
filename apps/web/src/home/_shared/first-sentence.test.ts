import { describe, expect, it } from "vitest";
import { firstSentence } from "./first-sentence";

describe("firstSentence", () => {
  it("returns the empty string for missing input", () => {
    expect(firstSentence(null)).toBe("");
    expect(firstSentence(undefined)).toBe("");
    expect(firstSentence("")).toBe("");
  });

  it("stops at the first sentence terminator", () => {
    expect(firstSentence("Explore a vast world. Then conquer it!")).toBe(
      "Explore a vast world."
    );
    expect(firstSentence("Can you survive? Find out.")).toBe("Can you survive?");
  });

  it("stops at the first paragraph break before looking for a terminator", () => {
    expect(firstSentence("A roguelike with heart\r\n\r\nSecond paragraph. More.")).toBe(
      "A roguelike with heart"
    );
  });

  it("does not split on a period that is not followed by whitespace", () => {
    expect(firstSentence("Play v1.5 now. It rocks.")).toBe("Play v1.5 now.");
  });

  it("returns the whole paragraph trimmed when no terminator is present", () => {
    expect(firstSentence("  No terminator here  ")).toBe("No terminator here");
  });
});
