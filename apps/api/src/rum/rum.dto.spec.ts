import { RUM_MAX_SAMPLES } from "@vyoh/shared";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { RumBeaconDto } from "./rum.dto";

// Which fields the global `ValidationPipe` would reject, run with the same
// options `main.ts` configures it with.
function failedFields(payload: Record<string, unknown>): string[] {
  const errors = validateSync(plainToInstance(RumBeaconDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property).sort();
}

const SAMPLE = {
  id: "v6-1790861459105-4815162342108",
  name: "LCP",
  value: 2256.4,
  rating: "good",
};
const BEACON = {
  route: "/lol/$accountSlug/matches",
  formFactor: "desktop",
  navigationType: "navigate",
  samples: [
    SAMPLE,
    { ...SAMPLE, id: "v6-1790861459105-1234567890123", name: "CLS", value: 0.02 },
  ],
};

describe("RumBeaconDto", () => {
  it("accepts what web-vitals reports from a page load", () => {
    expect(failedFields(BEACON)).toEqual([]);
    expect(failedFields({ ...BEACON, route: "/" })).toEqual([]);
  });

  it("rejects a route outside the template charset or length", () => {
    for (const route of [
      "/lol/vyoh?x=1",
      "/lol/Ahri%20Main",
      "/a#b",
      "lol",
      "/".repeat(121),
    ]) {
      expect(failedFields({ ...BEACON, route })).toEqual(["route"]);
    }
  });

  it("rejects samples a browser would not send", () => {
    const bad = [
      { ...SAMPLE, id: "1" },
      { ...SAMPLE, name: "FID" },
      { ...SAMPLE, value: -1 },
      { ...SAMPLE, value: Number.NaN },
      { ...SAMPLE, value: 600_001 },
      { ...SAMPLE, rating: "great" },
      { ...SAMPLE, extra: true },
    ];
    for (const sample of bad) {
      expect(failedFields({ ...BEACON, samples: [sample] })).toEqual(["samples"]);
    }
  });

  it("bounds the sample count to one per metric", () => {
    const many = Array.from({ length: RUM_MAX_SAMPLES + 1 }, () => SAMPLE);
    expect(failedFields({ ...BEACON, samples: many })).toEqual(["samples"]);
    expect(failedFields({ ...BEACON, samples: [] })).toEqual(["samples"]);
  });

  it("rejects fields the beacon does not define", () => {
    expect(failedFields({ ...BEACON, userAgent: "x" })).toEqual(["userAgent"]);
  });
});
