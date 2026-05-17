import { describe, expect, it } from "vitest";
import { parsePatchWikitext, stripTemplates } from "./patch-parser";

const FIXTURE = `
Some preamble we ignore.

== Champions ==
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

== Items ==
;{{ii|Sundered Sky}}
* Cost reduced.
`;

describe("parsePatchWikitext", () => {
  it("extracts changes scoped to the Champions section only", () => {
    const changes = parsePatchWikitext(FIXTURE);
    // 2 Ambessa + 4 Lee Sin = 6, items section ignored.
    expect(changes).toHaveLength(6);
    expect(
      changes.every((c) => c.champion === "Ambessa" || c.champion === "Lee Sin")
    ).toBe(true);
  });

  it("attaches champion + ability anchors to each change line", () => {
    const changes = parsePatchWikitext(FIXTURE);
    const ambessaQ = changes.filter(
      (c) => c.champion === "Ambessa" && c.ability === "Cunning Sweep"
    );
    expect(ambessaQ).toHaveLength(2);
    const leeW = changes.filter(
      (c) => c.champion === "Lee Sin" && c.ability === "Safeguard"
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

  it("returns an empty array when the Champions section is missing", () => {
    expect(parsePatchWikitext("== Items ==\n;{{ii|Foo}}\n* Bar.")).toEqual([]);
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

  it("falls back to joined args for unknown templates", () => {
    expect(stripTemplates("{{unknown|first arg|second}}")).toBe("first arg second");
  });

  it("normalizes whitespace runs", () => {
    expect(stripTemplates("foo    bar\n\nbaz")).toBe("foo bar baz");
  });
});
