import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { SteamAppidParamDto } from "./steam-appid-param.dto";

async function check(appid: string): Promise<{ appid: unknown; errors: number }> {
  const dto = plainToInstance(SteamAppidParamDto, { appid });
  const errors = await validate(dto);
  return { appid: dto.appid, errors: errors.length };
}

describe("SteamAppidParamDto", () => {
  it("coerces a numeric path segment to an integer", async () => {
    await expect(check("1034140")).resolves.toEqual({ appid: 1034140, errors: 0 });
  });

  it("rejects non-numeric, fractional and non-positive appids", async () => {
    for (const bad of ["abc", "12.5", "0", "-3"]) {
      expect((await check(bad)).errors, bad).toBeGreaterThan(0);
    }
  });
});
