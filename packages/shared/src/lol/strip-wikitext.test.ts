import { describe, expect, it } from "vitest";
import { stripWikitext } from "./strip-wikitext";

describe("stripWikitext", () => {
  it("keeps the first positional arg of `{{as|...}}`", () => {
    expect(stripWikitext("{{as|200% '''base''' AD}}")).toBe("200% base AD");
  });

  it("rewrites `[[anchor|display]]` to display text and `[[anchor]]` to anchor", () => {
    expect(stripWikitext("Apply [[Champion ability|ability]] now")).toBe(
      "Apply ability now"
    );
    expect(stripWikitext("Cast [[Recall]] to base")).toBe("Cast Recall to base");
  });

  it("resolves nested templates inside-out", () => {
    const out = stripWikitext(
      "Gain {{as|10 ability haste}} from {{as|{{ai|Recall|self}}}}"
    );
    expect(out).toBe("Gain 10 ability haste from Recall");
  });

  it("drops named-flag arguments like `icononly=true`", () => {
    expect(stripWikitext("{{tip|cr|icononly=true}}")).toBe("cr");
  });

  it("falls back to the template name when there is no positional arg", () => {
    expect(stripWikitext("Known issue.{{bug}}")).toBe("Known issue.bug");
  });

  it("renders a realistic Trinity Force passive description as plain text", () => {
    const wikitext =
      "After using an [[Champion ability|ability]], your next basic attack within 10 seconds deals {{as|200% '''base''' AD}} {{as|'''bonus''' physical damage}} [[on-hit]] ({{fd|1.5}} second cooldown).";
    expect(stripWikitext(wikitext)).toBe(
      "After using an ability, your next basic attack within 10 seconds deals 200% base AD bonus physical damage on-hit (1.5 second cooldown)."
    );
  });

  it("strips HTML comments inline", () => {
    expect(stripWikitext("foo<!-- internal note -->bar")).toBe("foobar");
  });

  it("returns empty string for empty input", () => {
    expect(stripWikitext("")).toBe("");
  });
});
