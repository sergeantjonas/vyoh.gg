import { parseMatchQuery } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { buildChips } from "./command-palette-chips";

function chipFor(input: string) {
  return buildChips(input, parseMatchQuery(input));
}

describe("buildChips", () => {
  it("returns no chips for empty input", () => {
    expect(chipFor("")).toEqual([]);
  });

  it("returns no chips for freeText-only input", () => {
    expect(chipFor("nida kha")).toEqual([]);
  });

  it("renders a chip per with: occurrence", () => {
    const chips = chipFor("with:nidalee with:akali");
    expect(chips.map((c) => c.label)).toEqual(["with: nidalee", "with: akali"]);
  });

  it("renders a vs: chip", () => {
    expect(chipFor("vs:khazix").map((c) => c.label)).toEqual(["vs: khazix"]);
  });

  it("renders outcome as a 'wins' chip", () => {
    expect(chipFor("wins").map((c) => c.label)).toEqual(["wins"]);
  });

  it("renders outcome as a 'losses' chip", () => {
    expect(chipFor("losses").map((c) => c.label)).toEqual(["losses"]);
  });

  it("renders queue/role/patch/duo chips", () => {
    const chips = chipFor("queue:soloq role:jungle patch:14.20 duo:foo#euw");
    expect(chips.map((c) => c.label)).toEqual([
      "queue: soloq",
      "role: jungle",
      "patch: 14.20",
      "duo: foo#euw",
    ]);
  });

  it("renders a single since chip showing the user's literal value", () => {
    const chips = chipFor("since:7d");
    expect(chips.map((c) => c.label)).toEqual(["since: 7d"]);
  });

  it("renders kda chips with operator + numeric value", () => {
    expect(chipFor("kda>3").map((c) => c.label)).toEqual(["kda > 3"]);
    expect(chipFor("kda<2").map((c) => c.label)).toEqual(["kda < 2"]);
  });

  it("collapses repeated last-wins verbs into a single chip showing the last value", () => {
    const chips = chipFor("since:7d since:1d");
    expect(chips).toHaveLength(1);
    expect(chips[0]?.label).toBe("since: 1d");
  });

  it("does not render chips for empty verb values", () => {
    expect(chipFor("with: vs: since: kda>")).toEqual([]);
  });

  it("removes a single with: token by clicking its chip", () => {
    const chips = chipFor("with:nidalee with:akali wins");
    const target = chips.find((c) => c.label === "with: nidalee");
    expect(target).toBeDefined();
    expect(target?.remove("with:nidalee with:akali wins")).toBe("with:akali wins");
  });

  it("removes an outcome chip", () => {
    const chips = chipFor("with:nidalee wins");
    const target = chips.find((c) => c.label === "wins");
    expect(target?.remove("with:nidalee wins")).toBe("with:nidalee");
  });

  it("removes ALL occurrences of a last-wins verb when chip is clicked", () => {
    const chips = chipFor("since:7d since:1d");
    expect(chips[0]?.remove("since:7d since:1d")).toBe("");
  });

  it("removes all kda> occurrences regardless of which shadowed value the chip displays", () => {
    const chips = chipFor("kda>2 kda>4");
    expect(chips[0]?.remove("kda>2 kda>4")).toBe("");
  });

  it("normalizes whitespace after token removal", () => {
    const chips = chipFor("with:nidalee  wins  kda>3");
    const target = chips.find((c) => c.label === "wins");
    expect(target?.remove("with:nidalee  wins  kda>3")).toBe("with:nidalee kda>3");
  });

  it("removes a vs: chip cleanly via its remove handler", () => {
    const chips = chipFor("vs:khazix wins");
    const vs = chips.find((c) => c.label === "vs: khazix");
    expect(vs?.remove("vs:khazix wins")).toBe("wins");
  });

  it("removes a queue: chip via its remove handler", () => {
    const chips = chipFor("queue:soloq with:nidalee");
    const q = chips.find((c) => c.label === "queue: soloq");
    expect(q?.remove("queue:soloq with:nidalee")).toBe("with:nidalee");
  });

  it("removes a role: chip via its remove handler", () => {
    const chips = chipFor("role:jungle wins");
    const r = chips.find((c) => c.label === "role: jungle");
    expect(r?.remove("role:jungle wins")).toBe("wins");
  });

  it("removes a patch: chip via its remove handler", () => {
    const chips = chipFor("patch:14.20 wins");
    const p = chips.find((c) => c.label === "patch: 14.20");
    expect(p?.remove("patch:14.20 wins")).toBe("wins");
  });

  it("removes a duo: chip via its remove handler", () => {
    const chips = chipFor("duo:foo#euw wins");
    const d = chips.find((c) => c.label === "duo: foo#euw");
    expect(d?.remove("duo:foo#euw wins")).toBe("wins");
  });

  it("renders a single until chip showing the user's literal value", () => {
    const chips = chipFor("until:2026-01-01");
    expect(chips.map((c) => c.label)).toEqual(["until: 2026-01-01"]);
  });

  it("removes ALL occurrences of until: when its chip is clicked", () => {
    const chips = chipFor("until:7d until:1d");
    expect(chips[0]?.remove("until:7d until:1d")).toBe("");
  });

  it("removes ALL kda< occurrences regardless of which value the chip displays", () => {
    const chips = chipFor("kda<2 kda<4");
    expect(chips[0]?.remove("kda<2 kda<4")).toBe("");
  });

  it("lastTailWithPrefix returns an empty label when the verb has no value (since:)", () => {
    // `since:` with no trailing value — the parser may still flag since as
    // present (when followed by another keyword); but since needs a value to
    // even register, so this is more of a defensive null-return check.
    const chips = chipFor("since: wins");
    // since: with no value won't produce a since chip — the parsed.since
    // is null. Confirm that and that we only see the outcome chip.
    expect(chips.map((c) => c.label)).toEqual(["wins"]);
  });
});
