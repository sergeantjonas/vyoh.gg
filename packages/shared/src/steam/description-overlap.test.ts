import { describe, expect, it } from "vitest";
import { stripLeadingOverlapWithShort } from "./description-overlap.ts";

describe("stripLeadingOverlapWithShort", () => {
  it("returns the body unchanged when no short description is supplied", () => {
    expect(stripLeadingOverlapWithShort("hello world", null)).toBe("hello world");
    expect(stripLeadingOverlapWithShort("hello world", undefined)).toBe("hello world");
    expect(stripLeadingOverlapWithShort("hello world", "")).toBe("hello world");
  });

  it("returns the body unchanged when the short description is too thin to compare", () => {
    // 1-2 content word shorts would over-trigger on shared nouns; bail.
    const bbcode = "Adventure awaits in this thrilling new release.";
    expect(stripLeadingOverlapWithShort(bbcode, "Game.")).toBe(bbcode);
  });

  it("strips leading lines that fully overlap with the short (Resident Evil 4 case)", () => {
    const short =
      "Survival is just the beginning. Six years have passed since the biological disaster in Raccoon City. Leon S. Kennedy, one of the survivors, tracks the president's kidnapped daughter to a secluded European village, where there is something terribly wrong with the locals.";
    const bbcode = [
      "Survival is just the beginning.",
      "",
      "Six years have passed since the biological disaster in Raccoon City.",
      "Agent Leon S. Kennedy, one of the survivors of the incident, has been sent to rescue the president's kidnapped daughter.",
      "He tracks her to a secluded European village, where there is something terribly wrong with the locals.",
      "And the curtain rises on this story of daring rescue and grueling horror where life and death, terror and catharsis intersect.",
      "",
      "Featuring modernized gameplay, a reimagined storyline, and vividly detailed graphics,",
      "Resident Evil 4 marks the rebirth of an industry juggernaut.",
      "",
      "Relive the nightmare that revolutionized survival horror.",
    ].join("\n");
    const out = stripLeadingOverlapWithShort(bbcode, short);
    // Leading 4 overlapping lines dropped, "And the curtain rises…" survives.
    expect(out.startsWith("And the curtain rises")).toBe(true);
    expect(out).toContain("Featuring modernized gameplay");
    expect(out).toContain("Relive the nightmare");
    // None of the dropped sentences remain.
    expect(out).not.toContain("Survival is just the beginning");
    expect(out).not.toContain("Agent Leon");
    expect(out).not.toContain("biological disaster");
  });

  it("leaves a tagline-style short alone (no overlap with the body)", () => {
    // The short is editorial standalone; the full opens with unrelated copy.
    const short = "A roguelike deckbuilder for the cosmically curious.";
    const bbcode = [
      "Welcome to the void between stars, traveller.",
      "",
      "Build your hand. Outwit the colossi. Become the constellation.",
    ].join("\n");
    expect(stripLeadingOverlapWithShort(bbcode, short)).toBe(bbcode);
  });

  it("stops at the first line that doesn't overlap (preserves new content)", () => {
    const short = "Defeat the dragon king and save the realm of Aldoria.";
    const bbcode = [
      "Defeat the dragon king and save Aldoria.",
      "",
      "Featuring 40 hours of branching narrative content.",
    ].join("\n");
    const out = stripLeadingOverlapWithShort(bbcode, short);
    // First line strips (dragon, king, save, aldoria all match).
    expect(out.startsWith("Featuring 40 hours")).toBe(true);
  });

  it("stops at the first BBCode tag — never strips structured content", () => {
    const short = "Survival is just the beginning of the long dark journey.";
    const bbcode = [
      "[h1]About this game[/h1]",
      "",
      "Survival is just the beginning.",
    ].join("\n");
    // The heading is the first non-blank line — stripper bails before
    // ever considering the overlapping plain-text line that follows.
    expect(stripLeadingOverlapWithShort(bbcode, short)).toBe(bbcode);
  });

  it("ignores leading lines too short to score meaningfully (single-word headers)", () => {
    const short = "An adventure across the dark forest of Eldenore.";
    const bbcode = ["Eldenore.", "", "A new chapter begins."].join("\n");
    // The 1-content-word line is below MIN_LINE_CONTENT_WORDS — stripper
    // returns 0 overlap (not 1.0) and bails, keeping the body intact.
    expect(stripLeadingOverlapWithShort(bbcode, short)).toBe(bbcode);
  });

  it("filters common stopwords so 'the' and 'of' don't inflate overlap", () => {
    // Both strings share several stopwords but no content overlap.
    const short = "Explore the depths of the abyss.";
    const bbcode = "Walk on the shores of the river that flows by the village.";
    expect(stripLeadingOverlapWithShort(bbcode, short)).toBe(bbcode);
  });

  it("preserves blank line structure after the first kept line", () => {
    const short = "Defeat the dragon king and save the realm of Aldoria.";
    const bbcode = [
      "Defeat the dragon king of Aldoria.",
      "",
      "Chapter 1: The forest.",
      "",
      "Chapter 2: The keep.",
    ].join("\n");
    const out = stripLeadingOverlapWithShort(bbcode, short);
    expect(out).toBe(["Chapter 1: The forest.", "", "Chapter 2: The keep."].join("\n"));
  });
});
