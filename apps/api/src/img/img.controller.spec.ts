import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImgController } from "./img.controller";
import { LolImageService } from "./lol-image.service";
import { SteamImageService } from "./steam-image.service";
import * as upstream from "./upstream";

const fetchChainSpy = vi.spyOn(upstream, "fetchUpstreamChain");
const fetchUpstreamSpy = vi.spyOn(upstream, "fetchUpstream");
const transcodeSpy = vi.spyOn(upstream, "transcodeToWebp");

interface ResStub {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function makeRes(): ResStub & { _status: number } {
  const send = vi.fn();
  const wrapper: ResStub & { _status: number } = {
    _status: 200,
    status: vi.fn(),
    send,
  };
  wrapper.status.mockImplementation((code: number) => {
    wrapper._status = code;
    return wrapper;
  });
  return wrapper;
}

function makeController(
  lolOverrides: Partial<LolImageService> = {},
  steamOverrides: Partial<SteamImageService> = {}
): ImgController {
  const lol = {
    champion: vi.fn().mockReturnValue({ urls: ["https://lol/champ"], params: {} }),
    item: vi.fn().mockReturnValue({ urls: ["https://lol/item"], params: {} }),
    rune: vi.fn().mockResolvedValue({ urls: ["https://lol/rune"], params: {} }),
    spell: vi.fn().mockResolvedValue({ urls: ["https://lol/spell"], params: {} }),
    roleIconUrl: vi.fn().mockReturnValue("https://lol/role-mid"),
    ...lolOverrides,
  } as unknown as LolImageService;
  const steam = {
    capsule: vi.fn().mockResolvedValue({ urls: ["https://steam/cap"], params: {} }),
    libraryCapsule: vi
      .fn()
      .mockResolvedValue({ urls: ["https://steam/lib"], params: {} }),
    hero: vi.fn().mockResolvedValue({ urls: ["https://steam/hero"], params: {} }),
    logo: vi.fn().mockResolvedValue({ urls: ["https://steam/logo"], params: {} }),
    backdrop: vi.fn().mockResolvedValue({ urls: ["https://steam/backdrop"], params: {} }),
    achievement: vi.fn().mockResolvedValue({ urls: ["https://steam/ach"], params: {} }),
    achievementGray: vi
      .fn()
      .mockResolvedValue({ urls: ["https://steam/ach-gray"], params: {} }),
    ...steamOverrides,
  } as unknown as SteamImageService;
  return new ImgController(lol, steam);
}

beforeEach(() => {
  fetchChainSpy.mockResolvedValue(Buffer.from([1, 2, 3]));
  transcodeSpy.mockResolvedValue(Buffer.from([4, 5, 6]));
  fetchUpstreamSpy.mockResolvedValue(Buffer.from("<svg/>"));
});

afterEach(() => {
  fetchChainSpy.mockReset();
  fetchUpstreamSpy.mockReset();
  transcodeSpy.mockReset();
});

describe("ImgController.champion", () => {
  it("returns 400 for an unknown variant slug", async () => {
    const res = makeRes();
    await makeController().champion("ahri", "garbage", res as never);
    expect(res._status).toBe(400);
    expect(res.send).toHaveBeenCalled();
  });

  it("proxies through fetchUpstreamChain + transcodeToWebp for a valid variant", async () => {
    const res = makeRes();
    await makeController().champion("ahri", "square", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
    expect(upstream.transcodeToWebp).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("returns 502 when the upstream chain throws an UpstreamError", async () => {
    fetchChainSpy.mockRejectedValueOnce(
      new upstream.UpstreamError("https://up", new Error("all upstreams failed"))
    );
    const res = makeRes();
    await makeController().champion("ahri", "square", res as never);
    expect(res._status).toBe(502);
  });

  it("rethrows non-UpstreamError errors", async () => {
    fetchChainSpy.mockRejectedValueOnce(new Error("real bug"));
    const res = makeRes();
    await expect(
      makeController().champion("ahri", "square", res as never)
    ).rejects.toThrow(/real bug/);
  });
});

describe("ImgController numeric-id BAD_REQUEST guards", () => {
  it.each([
    {
      name: "item",
      call: (c: ImgController, res: ResStub) => c.item("abc", "10.1", res as never),
    },
    {
      name: "rune",
      call: (c: ImgController, res: ResStub) => c.rune("abc", res as never),
    },
    {
      name: "spell",
      call: (c: ImgController, res: ResStub) => c.spell("abc", res as never),
    },
    {
      name: "steamCapsule",
      call: (c: ImgController, res: ResStub) => c.steamCapsule("abc", res as never),
    },
    {
      name: "steamLibraryCapsule",
      call: (c: ImgController, res: ResStub) =>
        c.steamLibraryCapsule("abc", res as never),
    },
    {
      name: "steamHero",
      call: (c: ImgController, res: ResStub) => c.steamHero("abc", res as never),
    },
    {
      name: "steamLogo",
      call: (c: ImgController, res: ResStub) => c.steamLogo("abc", res as never),
    },
    {
      name: "steamBackdrop",
      call: (c: ImgController, res: ResStub) => c.steamBackdrop("abc", res as never),
    },
    {
      name: "steamAchievement",
      call: (c: ImgController, res: ResStub) =>
        c.steamAchievement("abc", "FIRST_KILL", res as never),
    },
    {
      name: "steamAchievementGray",
      call: (c: ImgController, res: ResStub) =>
        c.steamAchievementGray("abc", "FIRST_KILL", res as never),
    },
  ])("$name returns 400 for a non-numeric id", async ({ call }) => {
    const res = makeRes();
    await call(makeController(), res);
    expect(res._status).toBe(400);
  });
});

describe("ImgController happy paths", () => {
  it("item proxies through the lol service and upstream chain", async () => {
    const res = makeRes();
    await makeController().item("3001", "26.10", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("rune awaits the lol.rune resolver and proxies the chain", async () => {
    const res = makeRes();
    await makeController().rune("8112", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("spell awaits the lol.spell resolver and proxies the chain", async () => {
    const res = makeRes();
    await makeController().spell("4", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it.each([
    { method: "steamCapsule" as const },
    { method: "steamLibraryCapsule" as const },
    { method: "steamHero" as const },
    { method: "steamLogo" as const },
    { method: "steamBackdrop" as const },
  ])("$method proxies the chain", async ({ method }) => {
    const res = makeRes();
    const controller = makeController();
    await (
      controller as unknown as Record<string, (a: string, b: never) => Promise<void>>
    )[method]?.("42", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("steamAchievement proxies the chain with appid + apiName", async () => {
    const res = makeRes();
    await makeController().steamAchievement("42", "FIRST_KILL", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("steamAchievementGray proxies the chain with appid + apiName", async () => {
    const res = makeRes();
    await makeController().steamAchievementGray("42", "FIRST_KILL", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });
});

describe("ImgController.role", () => {
  it("returns 400 for an unknown role slug", async () => {
    const res = makeRes();
    await makeController().role("notarole", res as never);
    expect(res._status).toBe(400);
  });

  it("proxies the SVG through fetchUpstream for a valid role", async () => {
    const res = makeRes();
    await makeController().role("middle", res as never);
    expect(upstream.fetchUpstream).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("returns 502 when fetchUpstream throws an UpstreamError", async () => {
    fetchUpstreamSpy.mockRejectedValueOnce(
      new upstream.UpstreamError("https://up", new Error("svg upstream dead"))
    );
    const res = makeRes();
    await makeController().role("middle", res as never);
    expect(res._status).toBe(502);
  });

  it("rethrows non-UpstreamError errors from fetchUpstream", async () => {
    fetchUpstreamSpy.mockRejectedValueOnce(new Error("bug"));
    const res = makeRes();
    await expect(makeController().role("middle", res as never)).rejects.toThrow(/bug/);
  });
});
