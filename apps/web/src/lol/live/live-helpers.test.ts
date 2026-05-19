import type { LiveGameParticipant, LolAccount } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  championFallbackUrl,
  championPrimaryUrl,
  computeTeamComp,
  fetchChampionInfo,
  formatSeconds,
  isUserParticipant,
  mapLabel,
  queueLabel,
} from "./live-helpers";

describe("queueLabel", () => {
  it("returns the named queue for known queue ids", () => {
    expect(queueLabel(420)).toBe("Ranked Solo/Duo");
    expect(queueLabel(440)).toBe("Ranked Flex");
    expect(queueLabel(450)).toBe("ARAM");
    expect(queueLabel(490)).toBe("Quickplay");
    expect(queueLabel(1700)).toBe("Arena");
  });

  it("falls back to 'Queue <id>' for unknown queue ids", () => {
    expect(queueLabel(9999)).toBe("Queue 9999");
  });
});

describe("mapLabel", () => {
  it("returns the named map for known map ids", () => {
    expect(mapLabel(11)).toBe("Summoner's Rift");
    expect(mapLabel(12)).toBe("Howling Abyss");
    expect(mapLabel(30)).toBe("Rings of Wrath");
  });

  it("falls back to 'Map <id>' for unknown map ids", () => {
    expect(mapLabel(999)).toBe("Map 999");
  });
});

describe("championPrimaryUrl", () => {
  it("builds a wsrv-proxied WebP URL with the requested width", () => {
    const url = championPrimaryUrl(266, 96);
    expect(url).toContain("wsrv.nl");
    expect(url).toContain("w=96");
    expect(url).toContain("output=webp");
    expect(url).toContain("/champion/266/square");
  });
});

describe("championFallbackUrl", () => {
  it("points at the community-dragon raw champion icon", () => {
    const url = championFallbackUrl(266);
    expect(url).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/266.png"
    );
  });
});

function participant(overrides: Partial<LiveGameParticipant> = {}): LiveGameParticipant {
  return {
    championId: 1,
    summonerName: "Test",
    summonerLevel: 30,
    teamId: 100,
    riotIdGameName: "Vyoh",
    riotIdTagLine: "EUW",
    spell1Id: 4,
    spell2Id: 14,
    ...overrides,
  } as unknown as LiveGameParticipant;
}

function lolAccount(overrides: Partial<LolAccount> = {}): LolAccount {
  return {
    slug: "vyoh-euw",
    region: "euw1",
    gameName: "Vyoh",
    tagLine: "EUW",
    ...overrides,
  };
}

describe("isUserParticipant", () => {
  it("returns false when no account is provided", () => {
    expect(isUserParticipant(participant(), undefined)).toBe(false);
  });

  it("matches gameName and tagLine case-insensitively", () => {
    const p = participant({ riotIdGameName: "VYOH", riotIdTagLine: "euw" });
    expect(isUserParticipant(p, lolAccount())).toBe(true);
  });

  it("returns false when gameName mismatches", () => {
    expect(
      isUserParticipant(participant({ riotIdGameName: "OtherPlayer" }), lolAccount())
    ).toBe(false);
  });

  it("returns false when tagLine mismatches", () => {
    expect(isUserParticipant(participant({ riotIdTagLine: "NA1" }), lolAccount())).toBe(
      false
    );
  });
});

describe("computeTeamComp", () => {
  it("returns 0 on every axis for an empty team", () => {
    const out = computeTeamComp([], {});
    expect(out.tank).toBe(0);
    expect(out.mage).toBe(0);
  });

  it("scores 100 on the axis when every champion shares a single role tag", () => {
    const out = computeTeamComp([1, 2, 3, 4, 5], {
      1: ["tank"],
      2: ["tank"],
      3: ["tank"],
      4: ["tank"],
      5: ["tank"],
    });
    expect(out.tank).toBe(100);
  });

  it("rounds the per-axis percentage", () => {
    // 3/5 marksman = 60%, 2/5 mage = 40%.
    const out = computeTeamComp([1, 2, 3, 4, 5], {
      1: ["marksman"],
      2: ["marksman"],
      3: ["marksman"],
      4: ["mage"],
      5: ["mage"],
    });
    expect(out.marksman).toBe(60);
    expect(out.mage).toBe(40);
  });

  it("counts multi-role champions toward every applicable axis", () => {
    const out = computeTeamComp([1], { 1: ["fighter", "tank"] });
    expect(out.fighter).toBe(100);
    expect(out.tank).toBe(100);
  });

  it("ignores role tags that aren't in COMP_AXES", () => {
    const out = computeTeamComp([1], { 1: ["fighter", "rune-hammer"] });
    expect(out.fighter).toBe(100);
  });
});

describe("formatSeconds", () => {
  it("zero-pads sub-10-second values", () => {
    expect(formatSeconds(65)).toBe("1:05");
  });

  it("formats large minute counts without truncation", () => {
    expect(formatSeconds(3599)).toBe("59:59");
    expect(formatSeconds(3661)).toBe("61:01");
  });

  it("floors fractional seconds", () => {
    expect(formatSeconds(60.7)).toBe("1:00");
  });

  it("handles 0 seconds", () => {
    expect(formatSeconds(0)).toBe("0:00");
  });
});

describe("fetchChampionInfo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the parsed JSON body on a 200 response", async () => {
    const payload = { name: "Aatrox", roles: ["fighter"] };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 }) as unknown as Response
    );
    expect(await fetchChampionInfo(266)).toEqual(payload);
  });

  it("returns null on a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not found", { status: 404 }) as unknown as Response
    );
    expect(await fetchChampionInfo(99999)).toBeNull();
  });

  it("returns null when fetch itself throws (network error)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    expect(await fetchChampionInfo(1)).toBeNull();
  });
});
