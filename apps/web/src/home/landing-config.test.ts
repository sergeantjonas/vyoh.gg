import { describe, expect, it } from "vitest";
import {
  AHRI_SKIN_ROTATION,
  HIDDEN_APPIDS,
  HIDDEN_QUEUE_IDS,
  STEAM_FEATURED_APPID,
} from "./landing-config";

describe("landing-config", () => {
  it("AHRI_SKIN_ROTATION carries at least one entry — the chapter assumes a Base", () => {
    expect(AHRI_SKIN_ROTATION.length).toBeGreaterThanOrEqual(1);
    expect(AHRI_SKIN_ROTATION[0]?.name).toBe("Base");
  });

  it("AHRI_SKIN_ROTATION entries are uniquely named — duplicate names would garble the rotation chip", () => {
    const names = AHRI_SKIN_ROTATION.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("HIDDEN_APPIDS and HIDDEN_QUEUE_IDS hold valid numeric ids only — typos would silently skip filtering", () => {
    for (const id of HIDDEN_APPIDS) expect(Number.isInteger(id) && id > 0).toBe(true);
    for (const id of HIDDEN_QUEUE_IDS) expect(Number.isInteger(id) && id >= 0).toBe(true);
  });

  it("STEAM_FEATURED_APPID is a positive integer and not hidden", () => {
    expect(Number.isInteger(STEAM_FEATURED_APPID)).toBe(true);
    expect(STEAM_FEATURED_APPID).toBeGreaterThan(0);
    expect(HIDDEN_APPIDS).not.toContain(STEAM_FEATURED_APPID);
  });
});
