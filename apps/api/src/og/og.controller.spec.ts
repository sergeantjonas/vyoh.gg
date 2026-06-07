import { Test } from "@nestjs/testing";
import { validate } from "class-validator";
import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  OgChampionAliasDto,
  OgMatchParamsDto,
  OgSlugDto,
  OgSteamAppidDto,
} from "./og-params.dto";
import { OgController } from "./og.controller";
import { OgService } from "./og.service";

async function makeController(stubs: Partial<OgService> = {}): Promise<OgController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [OgController],
    providers: [{ provide: OgService, useValue: stubs }],
  }).compile();
  return moduleRef.get(OgController);
}

describe("OgController.matchCard", () => {
  it("delegates to OgService.generateMatchCard and sends the PNG buffer", async () => {
    const png = Buffer.from("fake-png");
    const generateMatchCard = vi.fn().mockResolvedValue(png);
    const controller = await makeController({ generateMatchCard });
    const send = vi.fn();
    await controller.matchCard(
      { slug: "vyoh-ahri", matchId: "EUW1_42" } as OgMatchParamsDto,
      { send } as unknown as Response
    );
    expect(generateMatchCard).toHaveBeenCalledWith("vyoh-ahri", "EUW1_42");
    expect(send).toHaveBeenCalledWith(png);
  });
});

describe("OgController.championCard", () => {
  it("delegates to generateChampionCard with the alias param", async () => {
    const png = Buffer.from("champ-png");
    const generateChampionCard = vi.fn().mockResolvedValue(png);
    const controller = await makeController({ generateChampionCard });
    const send = vi.fn();
    await controller.championCard(
      { alias: "Jinx" } as OgChampionAliasDto,
      { send } as unknown as Response
    );
    expect(generateChampionCard).toHaveBeenCalledWith("Jinx");
    expect(send).toHaveBeenCalledWith(png);
  });
});

describe("OgController.profileCard", () => {
  it("delegates to generateProfileCard with the slug param", async () => {
    const png = Buffer.from("profile-png");
    const generateProfileCard = vi.fn().mockResolvedValue(png);
    const controller = await makeController({ generateProfileCard });
    const send = vi.fn();
    await controller.profileCard(
      { slug: "vyoh-ahri" } as OgSlugDto,
      { send } as unknown as Response
    );
    expect(generateProfileCard).toHaveBeenCalledWith("vyoh-ahri");
    expect(send).toHaveBeenCalledWith(png);
  });
});

describe("OgController.homeCard", () => {
  it("delegates to generateHomeCard with no params", async () => {
    const png = Buffer.from("home-png");
    const generateHomeCard = vi.fn().mockResolvedValue(png);
    const controller = await makeController({ generateHomeCard });
    const send = vi.fn();
    await controller.homeCard({ send } as unknown as Response);
    expect(generateHomeCard).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(png);
  });
});

describe("OgController.steamGameCard", () => {
  it("delegates to generateSteamGameCard with the parsed appid", async () => {
    const png = Buffer.from("steam-png");
    const generateSteamGameCard = vi.fn().mockResolvedValue(png);
    const controller = await makeController({ generateSteamGameCard });
    const send = vi.fn();
    await controller.steamGameCard(
      { appid: "1145360" } as OgSteamAppidDto,
      { send } as unknown as Response
    );
    expect(generateSteamGameCard).toHaveBeenCalledWith(1145360);
    expect(send).toHaveBeenCalledWith(png);
  });
});

describe("OgMatchParamsDto", () => {
  function make(overrides: Partial<OgMatchParamsDto>): OgMatchParamsDto {
    return Object.assign(new OgMatchParamsDto(), {
      slug: "vyoh-ahri",
      matchId: "EUW1_42",
      ...overrides,
    });
  }

  it("passes for valid inputs", async () => {
    expect(await validate(make({}))).toHaveLength(0);
  });

  it("rejects an empty slug", async () => {
    const errors = await validate(make({ slug: "" }));
    expect(errors.some((e) => e.property === "slug")).toBe(true);
  });

  it("rejects a matchId without platform prefix", async () => {
    const errors = await validate(make({ matchId: "42" }));
    expect(errors.some((e) => e.property === "matchId")).toBe(true);
  });
});

describe("OgChampionAliasDto", () => {
  it("accepts canonical and lowercase aliases", async () => {
    const dto = (alias: string) => Object.assign(new OgChampionAliasDto(), { alias });
    expect(await validate(dto("Jinx"))).toHaveLength(0);
    expect(await validate(dto("jinx"))).toHaveLength(0);
    expect(await validate(dto("MonkeyKing"))).toHaveLength(0);
    expect(await validate(dto("KSante"))).toHaveLength(0);
  });

  it("rejects aliases with non-alphanumeric characters", async () => {
    const dto = (alias: string) => Object.assign(new OgChampionAliasDto(), { alias });
    expect(await validate(dto("../etc/passwd"))).not.toHaveLength(0);
    expect(await validate(dto("Aurelion Sol"))).not.toHaveLength(0);
    expect(await validate(dto(""))).not.toHaveLength(0);
  });
});

describe("OgSteamAppidDto", () => {
  it("accepts numeric appids", async () => {
    const dto = (appid: string) => Object.assign(new OgSteamAppidDto(), { appid });
    expect(await validate(dto("1145360"))).toHaveLength(0);
    expect(await validate(dto("440"))).toHaveLength(0);
  });

  it("rejects non-numeric appids", async () => {
    const dto = (appid: string) => Object.assign(new OgSteamAppidDto(), { appid });
    expect(await validate(dto("abc"))).not.toHaveLength(0);
    expect(await validate(dto("1.5"))).not.toHaveLength(0);
  });
});
