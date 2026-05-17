import { describe, expect, it } from "vitest";
import { parsePatchWikitext, stripTemplates } from "./patch-parser";

const FIXTURE = `
Some preamble we ignore.

=== Champions ===
;{{ci|Ambessa}}
* {{ai|Cunning Sweep|Ambessa}}
** Target's health ratio increased to {{as|{{ap|2 to 3}}% of target's '''maximum''' health}} from {{as|{{ap|1 to 3}}%|health}}.
** Bonus monster damage reduced to 75 from 125.

;{{ci|Lee Sin}}
* {{ai|Safeguard|Lee Sin}}
** Base shield reduced to {{ap|60 to 240}} from {{ap|70 to 250}}.
** Cooldown reduced to 7 seconds from 12.
** {{sbc|Removed:}} If the targeted ally is a champion upon arrival, Lee Sin gains a shield.
** {{sbc|New Effect:}} When targeting an ally minion or ward, Lee Sin dashes to it.

=== Items ===
;{{ii|Doran's Bow}}
* Attack damage increased to 8 from 6.

;{{ii|Gluttonous Greaves}}
* Total cost increased to {{g|1000}} from {{g|950}}.
** Combine cost increased to {{g|700}} from {{g|650}}.
* Slay omnivamp per stack reduced to {{fd|0.6}}% from 1%.
* {{sbc|Bug Fix:}} Fixed a bug where it would not inherit the extra Move Speed from {{ii|Slightly Magical Boots}}.

=== Runes ===
;{{ri|Deathfire Touch}}
* Base damage per tick reduced to {{pp|1.5 to 6}} from {{pp|2 to 6}}.

;{{ri|Stormraider's Surge}}
* Bonus movement speed increased to {{rd|48%|36%}} from {{rd|40%|30%}}.

== See Also ==
;Should not appear
`;

describe("parsePatchWikitext", () => {
  it("extracts champion changes scoped to the Champions section", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const champs = changes.filter((c) => c.section === "champion");
    // 2 Ambessa + 4 Lee Sin = 6
    expect(champs).toHaveLength(6);
    expect(champs.every((c) => c.subject === "Ambessa" || c.subject === "Lee Sin")).toBe(
      true
    );
  });

  it("attaches champion + ability anchors to each change line", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const ambessaQ = changes.filter(
      (c) => c.subject === "Ambessa" && c.ability === "Cunning Sweep"
    );
    expect(ambessaQ).toHaveLength(2);
    const leeW = changes.filter(
      (c) => c.subject === "Lee Sin" && c.ability === "Safeguard"
    );
    expect(leeW).toHaveLength(4);
  });

  it("strips nested ap/as templates and bold markers", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const ratioLine = changes.find((c) =>
      c.changeText.startsWith("Target's health ratio")
    );
    expect(ratioLine?.changeText).toBe(
      "Target's health ratio increased to 2 to 3% of target's maximum health from 1 to 3%."
    );
  });

  it("classifies prose direction", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const buff = changes.find((c) => c.changeText.startsWith("Target's health ratio"));
    const nerf = changes.find((c) => c.changeText.startsWith("Bonus monster damage"));
    expect(buff?.changeType).toBe("buff");
    expect(nerf?.changeType).toBe("nerf");
  });

  it("classifies sbc-tagged change types ahead of direction words", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const removed = changes.find((c) => c.changeText.includes("If the targeted ally"));
    const newEffect = changes.find((c) =>
      c.changeText.includes("When targeting an ally")
    );
    expect(removed?.changeType).toBe("removed");
    expect(newEffect?.changeType).toBe("new_effect");
  });

  it("renders sbc-tagged lines with the label prefix preserved", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const removed = changes.find((c) => c.changeText.includes("If the targeted ally"));
    expect(removed?.changeText).toBe(
      "Removed: If the targeted ally is a champion upon arrival, Lee Sin gains a shield."
    );
  });

  it("returns an empty array when none of the three sections are present", () => {
    expect(parsePatchWikitext("== See Also ==\nNo content")).toEqual([]);
  });

  it("extracts item changes with `*` change lines and `**` sub-bullets flattened", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const items = changes.filter((c) => c.section === "item");
    // Doran's Bow: 1 line. Gluttonous Greaves: 4 lines (Total cost, Combine
    // cost, Slay omnivamp, Bug Fix). Total: 5.
    expect(items).toHaveLength(5);
    expect(items.every((c) => c.ability === null)).toBe(true);
    const subjects = new Set(items.map((c) => c.subject));
    expect(subjects).toEqual(new Set(["Doran's Bow", "Gluttonous Greaves"]));
  });

  it("strips gold and inline item templates in item change text", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const totalCost = changes.find(
      (c) => c.section === "item" && c.changeText.startsWith("Total cost")
    );
    expect(totalCost?.changeText).toBe("Total cost increased to 1000 from 950.");
    expect(totalCost?.changeType).toBe("buff");

    const bugFix = changes.find(
      (c) => c.section === "item" && c.changeText.startsWith("Bug Fix:")
    );
    expect(bugFix?.changeText).toBe(
      "Bug Fix: Fixed a bug where it would not inherit the extra Move Speed from Slightly Magical Boots."
    );
  });

  it("extracts rune changes with `pp` and `rd` template stripping", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const runes = changes.filter((c) => c.section === "rune");
    expect(runes).toHaveLength(2);
    expect(runes.every((c) => c.ability === null)).toBe(true);

    const deathfire = runes.find((c) => c.subject === "Deathfire Touch");
    expect(deathfire?.changeText).toBe(
      "Base damage per tick reduced to 1.5 to 6 from 2 to 6."
    );
    expect(deathfire?.changeType).toBe("nerf");

    const stormraider = runes.find((c) => c.subject === "Stormraider's Surge");
    expect(stormraider?.changeText).toBe(
      "Bonus movement speed increased to 48% from 40%."
    );
    expect(stormraider?.changeType).toBe("buff");
  });

  it("scopes items/runes parsing to their own sections", () => {
    // A `=== Champions ===` block with a stray `{{ii|...}}` line shouldn't
    // bleed into the items section, and vice versa.
    const wikitext = `
=== Champions ===
;{{ci|Ahri}}
* {{ai|Charm|Ahri}}
** Damage reduced to 50 from 60.

=== Items ===
;{{ii|Lich Bane}}
* Movement speed increased to 6% from 4%.
`;
    const changes = parsePatchWikitext(wikitext);
    expect(changes.filter((c) => c.section === "champion")).toHaveLength(1);
    expect(changes.filter((c) => c.section === "item")).toHaveLength(1);
    expect(changes.filter((c) => c.section === "rune")).toHaveLength(0);
  });
});

describe("stripTemplates", () => {
  it("collapses ap to its value arg", () => {
    expect(stripTemplates("Cooldown {{ap|7 to 5}} seconds")).toBe(
      "Cooldown 7 to 5 seconds"
    );
  });

  it("collapses as wrappers keeping the visible arg", () => {
    expect(stripTemplates("{{as|{{ap|60 to 240}}|shield}}")).toBe("60 to 240");
  });

  it("collapses gold/decimal/per-stack templates to their first arg", () => {
    expect(stripTemplates("Cost {{g|1000}} gold")).toBe("Cost 1000 gold");
    expect(stripTemplates("Stacks {{fd|0.6}}% per hit")).toBe("Stacks 0.6% per hit");
    expect(stripTemplates("Damage {{pp|2 to 6}}")).toBe("Damage 2 to 6");
  });

  it("collapses rank-dependent templates to the primary (first) tier", () => {
    expect(stripTemplates("Movement {{rd|48%|36%}}")).toBe("Movement 48%");
  });

  it("falls back to joined args for unknown templates", () => {
    expect(stripTemplates("{{unknown|first arg|second}}")).toBe("first arg second");
  });

  it("normalizes whitespace runs", () => {
    expect(stripTemplates("foo    bar\n\nbaz")).toBe("foo bar baz");
  });
});
