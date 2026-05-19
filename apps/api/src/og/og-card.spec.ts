import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("satori", () => ({
  default: vi
    .fn()
    .mockResolvedValue(
      "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='400'/>"
    ),
}));

vi.mock("@resvg/resvg-js", () => ({
  Resvg: class {
    render() {
      return { asPng: () => Buffer.from([0x89, 0x50, 0x4e, 0x47]) };
    }
  },
}));

vi.mock("./og-fonts", () => ({
  fonts: [
    {
      name: "Geist",
      data: Buffer.from([0, 0, 0, 0]),
      weight: 400 as const,
      style: "normal" as const,
    },
  ],
}));

import satori from "satori";
import { renderMatchCard } from "./og-card";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(Buffer.from([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(satori).mockClear();
});

describe("renderMatchCard", () => {
  const baseData = {
    championName: "Ahri",
    championAlias: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    queueType: "Ranked Solo",
    durationLabel: "30m 00s",
    accountLabel: "Vyoh#EUW",
    region: "EUW",
  };

  it("returns a Buffer with the PNG header bytes", async () => {
    const buf = await renderMatchCard(baseData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("passes the rendered element + font config to satori", async () => {
    await renderMatchCard(baseData);
    expect(satori).toHaveBeenCalled();
    const call = vi.mocked(satori).mock.calls[0];
    const options = call?.[1] as { fonts: { name: string }[] };
    expect(options.fonts[0]?.name).toBe("Geist");
  });

  it("renders the loss accent color path when win=false", async () => {
    await renderMatchCard({ ...baseData, win: false });
    expect(satori).toHaveBeenCalled();
  });

  it("throws when the splash fetch responds non-OK", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(renderMatchCard(baseData)).rejects.toThrow(/HTTP 500/);
  });

  it("falls back to image/jpeg when content-type is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(Buffer.from([1, 2, 3]), {
        status: 200,
        // No content-type header
      })
    );
    const buf = await renderMatchCard(baseData);
    expect(buf).toBeInstanceOf(Buffer);
  });
});
