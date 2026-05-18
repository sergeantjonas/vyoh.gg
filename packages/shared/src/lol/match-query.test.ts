import { describe, expect, it } from "vitest";
import { parseMatchQuery } from "./match-query.ts";

describe("parseMatchQuery", () => {
  it("returns an empty parse for empty input", () => {
    const result = parseMatchQuery("");
    expect(result.withChampions).toEqual([]);
    expect(result.vsChampions).toEqual([]);
    expect(result.outcome).toBeNull();
    expect(result.queues).toEqual([]);
    expect(result.roles).toEqual([]);
    expect(result.patches).toEqual([]);
    expect(result.duos).toEqual([]);
    expect(result.since).toBeNull();
    expect(result.until).toBeNull();
    expect(result.kdaGt).toBeNull();
    expect(result.kdaLt).toBeNull();
    expect(result.freeText).toBe("");
  });

  it("returns an empty parse for whitespace-only input", () => {
    expect(parseMatchQuery("   ").freeText).toBe("");
  });

  it("collects unrecognised tokens as freeText", () => {
    const result = parseMatchQuery("foo bar");
    expect(result.freeText).toBe("foo bar");
    expect(result.withChampions).toEqual([]);
    expect(result.vsChampions).toEqual([]);
    expect(result.outcome).toBeNull();
  });

  it("lowercases freeText tokens", () => {
    expect(parseMatchQuery("FoO BaR").freeText).toBe("foo bar");
  });

  it("collapses repeated whitespace in freeText", () => {
    expect(parseMatchQuery("aa    bb\tcc").freeText).toBe("aa bb cc");
  });

  it("extracts with: champion fragments", () => {
    const result = parseMatchQuery("with:nidalee");
    expect(result.withChampions).toEqual(["nidalee"]);
    expect(result.freeText).toBe("");
  });

  it("extracts vs: champion fragments", () => {
    const result = parseMatchQuery("vs:khazix");
    expect(result.vsChampions).toEqual(["khazix"]);
  });

  it("lowercases with: values", () => {
    expect(parseMatchQuery("with:Nidalee").withChampions).toEqual(["nidalee"]);
  });

  it("lowercases vs: values", () => {
    expect(parseMatchQuery("vs:KhaZix").vsChampions).toEqual(["khazix"]);
  });

  it("collects multiple with: occurrences in order", () => {
    expect(parseMatchQuery("with:nidalee with:akali").withChampions).toEqual([
      "nidalee",
      "akali",
    ]);
  });

  it("collects multiple vs: occurrences in order", () => {
    expect(parseMatchQuery("vs:khazix vs:graves").vsChampions).toEqual([
      "khazix",
      "graves",
    ]);
  });

  it("ignores verbs with empty values", () => {
    const result = parseMatchQuery(
      "with: vs: queue: role: patch: duo: since: until: kda> kda<"
    );
    expect(result.withChampions).toEqual([]);
    expect(result.vsChampions).toEqual([]);
    expect(result.queues).toEqual([]);
    expect(result.roles).toEqual([]);
    expect(result.patches).toEqual([]);
    expect(result.duos).toEqual([]);
    expect(result.since).toBeNull();
    expect(result.until).toBeNull();
    expect(result.kdaGt).toBeNull();
    expect(result.kdaLt).toBeNull();
    expect(result.freeText).toBe("");
  });

  it("captures bare 'wins' as a win outcome", () => {
    expect(parseMatchQuery("wins").outcome).toBe("win");
  });

  it("captures bare 'losses' as a loss outcome", () => {
    expect(parseMatchQuery("losses").outcome).toBe("loss");
  });

  it("matches outcome keywords case-insensitively", () => {
    expect(parseMatchQuery("WINS").outcome).toBe("win");
    expect(parseMatchQuery("Losses").outcome).toBe("loss");
  });

  it("resolves conflicting outcome keywords to the last one", () => {
    expect(parseMatchQuery("wins losses").outcome).toBe("loss");
    expect(parseMatchQuery("losses wins").outcome).toBe("win");
  });

  it("does not treat partial matches like 'win' or 'lost' as outcome keywords", () => {
    const result = parseMatchQuery("win lost winners");
    expect(result.outcome).toBeNull();
    expect(result.freeText).toBe("win lost winners");
  });

  it("composes verbs with freeText", () => {
    const result = parseMatchQuery("with:nidalee wins kha");
    expect(result.withChampions).toEqual(["nidalee"]);
    expect(result.outcome).toBe("win");
    expect(result.freeText).toBe("kha");
  });

  it("preserves the order of unrecognised tokens in freeText", () => {
    expect(parseMatchQuery("aa with:nida bb wins cc").freeText).toBe("aa bb cc");
  });

  it("composes with: and vs: together", () => {
    const result = parseMatchQuery("with:nidalee vs:khazix losses");
    expect(result.withChampions).toEqual(["nidalee"]);
    expect(result.vsChampions).toEqual(["khazix"]);
    expect(result.outcome).toBe("loss");
    expect(result.freeText).toBe("");
  });

  // -- queue: --

  it("extracts queue: fragments", () => {
    expect(parseMatchQuery("queue:soloq").queues).toEqual(["soloq"]);
  });

  it("lowercases queue: values", () => {
    expect(parseMatchQuery("queue:SoloQ").queues).toEqual(["soloq"]);
  });

  it("collects multiple queue: occurrences in order", () => {
    expect(parseMatchQuery("queue:soloq queue:flex").queues).toEqual(["soloq", "flex"]);
  });

  // -- role: --

  it("extracts role: fragments", () => {
    expect(parseMatchQuery("role:jungle").roles).toEqual(["jungle"]);
  });

  it("lowercases role: values", () => {
    expect(parseMatchQuery("role:JUNGLE").roles).toEqual(["jungle"]);
  });

  it("collects multiple role: occurrences in order", () => {
    expect(parseMatchQuery("role:jungle role:mid").roles).toEqual(["jungle", "mid"]);
  });

  // -- patch: --

  it("extracts patch: fragments", () => {
    expect(parseMatchQuery("patch:14.20").patches).toEqual(["14.20"]);
  });

  it("collects multiple patch: occurrences in order", () => {
    expect(parseMatchQuery("patch:14.20 patch:14.21").patches).toEqual([
      "14.20",
      "14.21",
    ]);
  });

  // -- duo: --

  it("extracts duo: fragments", () => {
    expect(parseMatchQuery("duo:foo#euw").duos).toEqual(["foo#euw"]);
  });

  it("lowercases duo: values", () => {
    expect(parseMatchQuery("duo:Foo#EUW").duos).toEqual(["foo#euw"]);
  });

  // -- since: / until: --

  it("parses relative day offsets for since:", () => {
    const now = new Date("2026-05-18T12:00:00Z").getTime();
    const result = parseMatchQuery("since:7d", now);
    expect(result.since).toEqual(new Date(now - 7 * 24 * 60 * 60 * 1000));
  });

  it("parses relative hour offsets for since:", () => {
    const now = new Date("2026-05-18T12:00:00Z").getTime();
    const result = parseMatchQuery("since:24h", now);
    expect(result.since).toEqual(new Date(now - 24 * 60 * 60 * 1000));
  });

  it("parses relative week offsets for since:", () => {
    const now = new Date("2026-05-18T12:00:00Z").getTime();
    const result = parseMatchQuery("since:2w", now);
    expect(result.since).toEqual(new Date(now - 14 * 24 * 60 * 60 * 1000));
  });

  it("parses ISO dates for since:", () => {
    const result = parseMatchQuery("since:2026-05-01");
    expect(result.since).toEqual(new Date("2026-05-01"));
  });

  it("parses relative offsets for until:", () => {
    const now = new Date("2026-05-18T12:00:00Z").getTime();
    const result = parseMatchQuery("until:3d", now);
    expect(result.until).toEqual(new Date(now - 3 * 24 * 60 * 60 * 1000));
  });

  it("parses ISO dates for until:", () => {
    const result = parseMatchQuery("until:2026-04-01");
    expect(result.until).toEqual(new Date("2026-04-01"));
  });

  it("ignores unparseable since: values", () => {
    expect(parseMatchQuery("since:nonsense").since).toBeNull();
  });

  it("ignores unparseable until: values", () => {
    expect(parseMatchQuery("until:not-a-date").until).toBeNull();
  });

  it("resolves conflicting since: keywords to the last one", () => {
    const now = new Date("2026-05-18T12:00:00Z").getTime();
    const result = parseMatchQuery("since:7d since:1d", now);
    expect(result.since).toEqual(new Date(now - 1 * 24 * 60 * 60 * 1000));
  });

  // -- kda>/< --

  it("parses kda> threshold", () => {
    expect(parseMatchQuery("kda>3").kdaGt).toBe(3);
  });

  it("parses kda< threshold", () => {
    expect(parseMatchQuery("kda<2").kdaLt).toBe(2);
  });

  it("parses fractional kda thresholds", () => {
    expect(parseMatchQuery("kda>2.5").kdaGt).toBe(2.5);
  });

  it("resolves conflicting kda> keywords to the last one", () => {
    expect(parseMatchQuery("kda>2 kda>4").kdaGt).toBe(4);
  });

  it("ignores non-numeric kda thresholds", () => {
    expect(parseMatchQuery("kda>abc").kdaGt).toBeNull();
  });

  // -- composition across full grammar --

  it("composes the full verb set", () => {
    const now = new Date("2026-05-18T12:00:00Z").getTime();
    const result = parseMatchQuery(
      "with:nidalee vs:khazix wins queue:soloq role:jungle patch:14.20 since:14d kda>3 duo:foo#euw kha",
      now
    );
    expect(result.withChampions).toEqual(["nidalee"]);
    expect(result.vsChampions).toEqual(["khazix"]);
    expect(result.outcome).toBe("win");
    expect(result.queues).toEqual(["soloq"]);
    expect(result.roles).toEqual(["jungle"]);
    expect(result.patches).toEqual(["14.20"]);
    expect(result.duos).toEqual(["foo#euw"]);
    expect(result.since).toEqual(new Date(now - 14 * 24 * 60 * 60 * 1000));
    expect(result.kdaGt).toBe(3);
    expect(result.freeText).toBe("kha");
  });
});
