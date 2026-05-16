import { NotFoundException } from "@nestjs/common";
import type { MatchDetail, ParticipantDetail } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { LolService } from "../lol/lol.service";
import { OgService } from "./og.service";

const renderMatchCardMock = vi.fn(async (_args: unknown) => Buffer.from("mock-png"));
vi.mock("./og-card", () => ({
  renderMatchCard: (args: unknown) => renderMatchCardMock(args),
}));

function participant(overrides: Partial<ParticipantDetail> = {}): ParticipantDetail {
  return {
    puuid: "puuid-1",
    riotIdGameName: "Vyoh",
    riotIdTagline: "Ahri",
    championName: "Ahri",
    teamId: 100,
    teamPosition: "MIDDLE",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    items: [],
    goldEarned: 12000,
    totalDamage: 25000,
    csTotal: 200,
    csPerMin: 7.5,
    visionScore: 30,
    wardsPlaced: 10,
    wardsKilled: 5,
    controlWardsPurchased: 3,
    kp: 0.5,
    damageShare: 0.25,
    goldShare: 0.22,
    damageDealtPhysical: 15000,
    damageDealtMagic: 8000,
    damageDealtTrue: 2000,
    summoner1Id: 4,
    summoner2Id: 14,
    keystone: 8214,
    championLevel: 18,
    ...overrides,
  };
}

function detail(participants: ParticipantDetail[]): MatchDetail {
  return {
    matchId: "EUW1_42",
    queueType: "Ranked Solo",
    durationSec: 1834, // 30m 34s
    playedAt: "2026-05-16T12:00:00.000Z",
    teams: [],
    participants,
  };
}

function makeService(
  lolStub: { getMatchDetail: ReturnType<typeof vi.fn> },
  identityStub: { findBySlug: ReturnType<typeof vi.fn> }
): OgService {
  return new OgService(
    lolStub as unknown as LolService,
    identityStub as unknown as IdentityService
  );
}

describe("OgService.generateMatchCard", () => {
  it("throws NotFoundException when no account matches the slug", async () => {
    const service = makeService(
      { getMatchDetail: vi.fn() },
      { findBySlug: vi.fn().mockReturnValue(undefined) }
    );

    await expect(service.generateMatchCard("nope", "EUW1_42")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("throws NotFoundException when the participant isn't in the match", async () => {
    const getMatchDetail = vi
      .fn()
      .mockResolvedValue(detail([participant({ riotIdGameName: "OtherPlayer" })]));
    const service = makeService(
      { getMatchDetail },
      {
        findBySlug: vi.fn().mockReturnValue({
          slug: "vyoh-ahri",
          gameName: "Vyoh",
          tagLine: "Ahri",
          region: "euw1",
        }),
      }
    );

    await expect(
      service.generateMatchCard("vyoh-ahri", "EUW1_42")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("matches on case-insensitive riotId and formats duration as Xm SSs", async () => {
    renderMatchCardMock.mockClear();
    const getMatchDetail = vi.fn().mockResolvedValue(
      detail([
        participant({
          // Casing intentionally differs from the account record
          riotIdGameName: "VYOH",
          riotIdTagline: "AHRI",
          championName: "Ahri",
          kills: 11,
          deaths: 4,
          assists: 7,
          win: true,
        }),
      ])
    );
    const service = makeService(
      { getMatchDetail },
      {
        findBySlug: vi.fn().mockReturnValue({
          slug: "vyoh-ahri",
          gameName: "Vyoh",
          tagLine: "Ahri",
          region: "euw1",
        }),
      }
    );

    await service.generateMatchCard("vyoh-ahri", "EUW1_42");

    expect(renderMatchCardMock).toHaveBeenCalledWith({
      championName: "Ahri",
      championAlias: "Ahri",
      kills: 11,
      deaths: 4,
      assists: 7,
      win: true,
      queueType: "Ranked Solo",
      durationLabel: "30m 34s",
      accountLabel: "Vyoh#Ahri",
      region: "EUW1",
    });
  });

  it("zero-pads seconds < 10 in the duration label", async () => {
    renderMatchCardMock.mockClear();
    const getMatchDetail = vi
      .fn()
      .mockResolvedValue({ ...detail([participant()]), durationSec: 65 });
    const service = makeService(
      { getMatchDetail },
      {
        findBySlug: vi.fn().mockReturnValue({
          slug: "vyoh-ahri",
          gameName: "Vyoh",
          tagLine: "Ahri",
          region: "euw1",
        }),
      }
    );

    await service.generateMatchCard("vyoh-ahri", "EUW1_42");

    expect(renderMatchCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ durationLabel: "1m 05s" })
    );
  });
});
