import { describe, expect, it, vi } from "vitest";
import { PatchController, normalizeChampions } from "./patch.controller";
import type { PatchService } from "./patch.service";

describe("normalizeChampions", () => {
  it("returns an empty list when the query param is missing", () => {
    expect(normalizeChampions(undefined)).toEqual([]);
  });

  it("wraps a single string into a one-element list and trims whitespace", () => {
    expect(normalizeChampions("  Ahri  ")).toEqual(["Ahri"]);
  });

  it("dedupes repeated names while preserving first-seen order", () => {
    expect(normalizeChampions(["Ahri", "Yasuo", "Ahri", "Lee Sin"])).toEqual([
      "Ahri",
      "Yasuo",
      "Lee Sin",
    ]);
  });

  it("caps the list at 20 entries", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Champion${i}`);
    expect(normalizeChampions(many)).toHaveLength(20);
  });

  it("drops empty strings without consuming a slot", () => {
    expect(normalizeChampions(["Ahri", "", "  ", "Yasuo"])).toEqual(["Ahri", "Yasuo"]);
  });
});

describe("PatchController", () => {
  function makeController(stubs: Partial<PatchService> = {}) {
    return new PatchController(stubs as PatchService);
  }

  it("listPatches() delegates to PatchService.listPatches", async () => {
    const list = [{ version: "16.10.1.1" }];
    const listPatches = vi.fn().mockResolvedValue(list);
    const ctrl = makeController({ listPatches });
    expect(await ctrl.listPatches()).toBe(list);
    expect(listPatches).toHaveBeenCalledOnce();
  });

  it("getCurrentChanges() forwards the normalized champion list", async () => {
    const payload = { version: "16.10.1.1", changes: [] };
    const getCurrentChanges = vi.fn().mockResolvedValue(payload);
    const ctrl = makeController({ getCurrentChanges });
    expect(await ctrl.getCurrentChanges(["Ahri", "Ahri", "  Yasuo  "])).toBe(payload);
    expect(getCurrentChanges).toHaveBeenCalledWith(["Ahri", "Yasuo"]);
  });

  it("getCurrentChanges() passes an empty list when no champion query is provided", async () => {
    const getCurrentChanges = vi
      .fn()
      .mockResolvedValue({ version: "16.10", changes: [] });
    const ctrl = makeController({ getCurrentChanges });
    await ctrl.getCurrentChanges(undefined);
    expect(getCurrentChanges).toHaveBeenCalledWith([]);
  });

  it("getChangesForVersion() forwards the version string to the service", async () => {
    const payload = {
      version: "26.10",
      championChanges: [],
      itemChanges: [],
      runeChanges: [],
    };
    const getChangesForVersion = vi.fn().mockResolvedValue(payload);
    const ctrl = makeController({ getChangesForVersion });
    expect(await ctrl.getChangesForVersion("26.10")).toBe(payload);
    expect(getChangesForVersion).toHaveBeenCalledWith("26.10");
  });
});
