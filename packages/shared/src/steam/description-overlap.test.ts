import { describe, expect, it } from "vitest";
import { stripLeadingOverlapWithShort } from "./description-overlap.ts";

describe("stripLeadingOverlapWithShort", () => {
  it("returns the body unchanged when no short description is supplied", () => {
    expect(stripLeadingOverlapWithShort("hello world", null)).toBe("hello world");
    expect(stripLeadingOverlapWithShort("hello world", undefined)).toBe("hello world");
    expect(stripLeadingOverlapWithShort("hello world", "")).toBe("hello world");
  });

  it("removes verbatim sentences but preserves paraphrased ones (Resident Evil 4 case)", () => {
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

    // The two verbatim opening sentences are gone.
    expect(out).not.toContain("Survival is just the beginning");
    expect(out).not.toContain("biological disaster");
    // But the paraphrased "Agent Leon…" line carries unique storytelling
    // ("Agent", "the incident", "has been sent to rescue") — the regex
    // wouldn't match it because it's a different sentence. Kept.
    expect(out).toContain("Agent Leon S. Kennedy");
    expect(out).toContain("the incident");
    expect(out).toContain("has been sent to rescue");
    // "He tracks her…" also isn't a verbatim match for the short's
    // "Leon S. Kennedy, one of the survivors, tracks…" sentence. Kept.
    expect(out).toContain("He tracks her");
    // The remaining body all the way through is untouched.
    expect(out).toContain("And the curtain rises");
    expect(out).toContain("Featuring modernized gameplay");
    expect(out).toContain("Relive the nightmare");
  });

  it("leaves a tagline-style short alone (no verbatim sentences in the full)", () => {
    const short = "A roguelike deckbuilder for the cosmically curious.";
    const bbcode = [
      "Welcome to the void between stars, traveller.",
      "",
      "Build your hand. Outwit the colossi. Become the constellation.",
    ].join("\n");
    expect(stripLeadingOverlapWithShort(bbcode, short)).toBe(bbcode);
  });

  it("matches across flexible whitespace (sentence broken across newlines)", () => {
    const short = "Defeat the dragon king of Aldoria.";
    const bbcode = "Defeat the dragon\nking of Aldoria.\n\nMore content follows.";
    const out = stripLeadingOverlapWithShort(bbcode, short);
    expect(out).toBe("More content follows.");
  });

  it("matches case-insensitively", () => {
    const short = "DEFEAT THE DRAGON KING OF ALDORIA.";
    const bbcode = "Defeat the Dragon King of Aldoria.\n\nMore content.";
    const out = stripLeadingOverlapWithShort(bbcode, short);
    expect(out).toBe("More content.");
  });

  it("removes sentences anywhere in the body (not just leading)", () => {
    // Publishers sometimes restate the short sentence mid-body for emphasis.
    const short = "Defeat the dragon king of Aldoria.";
    const bbcode = [
      "Begin your journey.",
      "",
      "Defeat the dragon king of Aldoria.",
      "",
      "Forge your destiny.",
    ].join("\n");
    const out = stripLeadingOverlapWithShort(bbcode, short);
    expect(out).toBe("Begin your journey.\n\nForge your destiny.");
  });

  it("ignores fragments below the minimum sentence length", () => {
    // A 1-word "sentence" like "Adventure." would match inside "Adventure
    // awaits the brave." — too risky. Skip it.
    const short = "Run.";
    const bbcode = "Run. Adventure awaits.";
    expect(stripLeadingOverlapWithShort(bbcode, short)).toBe(bbcode);
  });

  it("collapses blank-line runs left by the removal", () => {
    const short = "Defeat the dragon king of Aldoria.";
    const bbcode = [
      "Defeat the dragon king of Aldoria.",
      "",
      "",
      "",
      "More content follows.",
    ].join("\n");
    const out = stripLeadingOverlapWithShort(bbcode, short);
    expect(out).toBe("More content follows.");
  });

  it("preserves BBCode tags around the matched sentence", () => {
    // Defensive: if a publisher wrapped a sentence in `[b]...[/b]`, the
    // sentence content inside still gets removed, but the surrounding
    // tags are preserved as residual markup. Rare in practice; documented
    // here so future readers know it's a quirk, not a feature.
    const short = "Defeat the dragon king of Aldoria.";
    const bbcode = "[b]Defeat the dragon king of Aldoria.[/b]\n\nMore content.";
    const out = stripLeadingOverlapWithShort(bbcode, short);
    expect(out).toContain("[b]");
    expect(out).toContain("[/b]");
    expect(out).not.toContain("Defeat the dragon king");
    expect(out).toContain("More content");
  });
});
