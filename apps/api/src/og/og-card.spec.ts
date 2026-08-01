import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("satori", () => ({
  default: vi
    .fn()
    .mockResolvedValue(
      "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'/>"
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
import {
  renderChampionCard,
  renderHomeCard,
  renderMatchCard,
  renderProfileCard,
  renderSteamGameCard,
} from "./og-card";

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
    splashUrls: ["https://wiki.example/Ahri.jpg", "https://cdragon.example/ahri.jpg"],
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    queueLabel: "Ranked Solo",
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

  it("falls through to the second URL when the first responds non-OK", async () => {
    // Wiki blip → CDragon fallback — the same chain the proxy controller's
    // `proxyWebp` follows. The card must walk the URL list before throwing.
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(Buffer.from([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", mock);
    const buf = await renderMatchCard(baseData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("throws when every splash URL responds non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 }))
    );
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

describe("renderChampionCard", () => {
  it("returns a Buffer with the PNG header bytes", async () => {
    const buf = await renderChampionCard({
      championName: "Jinx",
      splashUrls: ["https://wiki.example/Jinx.jpg"],
      subLabel: "Marksman",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("invokes satori with the OG canonical dims", async () => {
    await renderChampionCard({
      championName: "Jinx",
      splashUrls: ["https://wiki.example/Jinx.jpg"],
      subLabel: "Marksman",
    });
    const call = vi.mocked(satori).mock.calls[0];
    const options = call?.[1] as { width: number; height: number };
    expect(options.width).toBe(1200);
    expect(options.height).toBe(630);
  });
});

describe("renderProfileCard", () => {
  it("returns a Buffer with the PNG header bytes", async () => {
    const buf = await renderProfileCard({
      accountLabel: "Vyoh#Ahri",
      rankLine: "Platinum III · 47 LP",
      kpis: [
        { label: "WR", value: "58%" },
        { label: "KDA", value: "3.4" },
        { label: "Games", value: "214" },
      ],
      region: "EUW",
      splashUrls: ["https://wiki.example/Ahri.jpg"],
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("renders the typographic-only fallback when splashUrls is empty", async () => {
    // The card pivots on `splashUrls.length === 0` — no upstream fetch path is
    // touched. Empty match window (fresh accounts) lands here cleanly instead
    // of throwing on a missing-splash fetch.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const buf = await renderProfileCard({
      accountLabel: "Vyoh#Ahri",
      rankLine: null,
      kpis: [],
      region: "EUW",
      splashUrls: [],
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("renderHomeCard", () => {
  it("returns a Buffer with the PNG header bytes", async () => {
    const buf = await renderHomeCard({
      tagline: "A personal cross-stream gaming dashboard",
    });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });
});

describe("renderSteamGameCard", () => {
  const baseData = {
    gameName: "Hades",
    heroUrls: ["https://cdn.example/hero.jpg"],
    shortDescription: "A rogue-like dungeon crawler from Supergiant.",
    kpis: [
      { label: "Playtime", value: "84h" },
      { label: "Achievements", value: "62%" },
      { label: "Last played", value: "2d ago" },
    ],
  };

  it("returns a Buffer with the PNG header bytes", async () => {
    const buf = await renderSteamGameCard(baseData);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("renders without the blurb block when shortDescription is null", async () => {
    const buf = await renderSteamGameCard({ ...baseData, shortDescription: null });
    expect(buf).toBeInstanceOf(Buffer);
  });
});
