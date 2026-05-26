import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImgController } from "./img.controller";
import { LolImageService } from "./lol-image.service";
import { SteamImageService } from "./steam-image.service";
import * as upstream from "./upstream";

const fetchChainSpy = vi.spyOn(upstream, "fetchUpstreamChain");
const transcodeSpy = vi.spyOn(upstream, "transcodeToWebp");
const streamSpy = vi.spyOn(upstream, "streamUpstream");

interface ResStub {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
}

function makeRes(): ResStub & { _status: number; _headers: Record<string, string> } {
  const send = vi.fn();
  const setHeader = vi.fn();
  const wrapper: ResStub & { _status: number; _headers: Record<string, string> } = {
    _status: 200,
    _headers: {},
    status: vi.fn(),
    send,
    setHeader,
  };
  wrapper.status.mockImplementation((code: number) => {
    wrapper._status = code;
    return wrapper;
  });
  wrapper.setHeader.mockImplementation((name: string, value: string) => {
    wrapper._headers[name] = value;
    return wrapper;
  });
  return wrapper;
}

function makeController(
  lolOverrides: Partial<LolImageService> = {},
  steamOverrides: Partial<SteamImageService> = {}
): ImgController {
  const lol = {
    champion: vi.fn().mockResolvedValue({ urls: ["https://lol/champ"], params: {} }),
    item: vi.fn().mockReturnValue({ urls: ["https://lol/item"], params: {} }),
    profileIcon: vi
      .fn()
      .mockResolvedValue({ urls: ["https://lol/profile-icon"], params: {} }),
    ability: vi.fn().mockResolvedValue({ urls: ["https://lol/ability"], params: {} }),
    map: vi.fn().mockReturnValue({ urls: ["https://lol/map"], params: {} }),
    rankEmblem: vi.fn().mockReturnValue({ urls: ["https://lol/rank"], params: {} }),
    uiIcon: vi.fn().mockReturnValue({ urls: ["https://lol/ui"], params: {} }),
    rune: vi.fn().mockResolvedValue({ urls: ["https://lol/rune"], params: {} }),
    spell: vi.fn().mockResolvedValue({ urls: ["https://lol/spell"], params: {} }),
    role: vi.fn().mockReturnValue({ urls: ["https://lol/role-mid"], params: {} }),
    champClass: vi.fn().mockReturnValue({ urls: ["https://lol/class-mage"], params: {} }),
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
});

afterEach(() => {
  fetchChainSpy.mockReset();
  transcodeSpy.mockReset();
  streamSpy.mockReset();
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
      name: "profileIcon",
      call: (c: ImgController, res: ResStub) =>
        c.profileIcon("abc", "10.1", res as never),
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
      call: (c: ImgController, res: ResStub) =>
        c.steamHero("abc", "noflip", res as never),
    },
    {
      name: "steamLogo",
      call: (c: ImgController, res: ResStub) => c.steamLogo("abc", res as never),
    },
    {
      name: "steamBackdrop",
      call: (c: ImgController, res: ResStub) =>
        c.steamBackdrop("abc", "noflip", res as never),
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

  it("profileIcon proxies through the lol service and upstream chain", async () => {
    const res = makeRes();
    await makeController().profileIcon("588", "26.10", res as never);
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
    { method: "steamLogo" as const },
  ])("$method proxies the chain", async ({ method }) => {
    const res = makeRes();
    const controller = makeController();
    await (
      controller as unknown as Record<string, (a: string, b: never) => Promise<void>>
    )[method]?.("42", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("steamHero proxies the chain when the flip segment is `noflip`", async () => {
    const res = makeRes();
    await makeController().steamHero("42", "noflip", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("steamBackdrop proxies the chain when the flip segment is `noflip`", async () => {
    const res = makeRes();
    await makeController().steamBackdrop("42", "noflip", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });

  it("steamHero passes flop=true when the flip segment is `flip`", async () => {
    const transcodeSpy = vi.spyOn(upstream, "transcodeToWebp");
    const res = makeRes();
    await makeController().steamHero("42", "flip", res as never);
    const callArgs = transcodeSpy.mock.calls[0]?.[1] as { flop?: boolean } | undefined;
    expect(callArgs?.flop).toBe(true);
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

describe("ImgController.ability", () => {
  it("returns 400 when championId is non-numeric", async () => {
    const res = makeRes();
    await makeController().ability("abc", "Q", "1", res as never);
    expect(res._status).toBe(400);
  });

  it("returns 400 when abilityIndex is non-numeric", async () => {
    const res = makeRes();
    await makeController().ability("103", "Q", "x", res as never);
    expect(res._status).toBe(400);
  });

  it("returns 404 when the resolver throws (ability row missing)", async () => {
    const controller = makeController({
      ability: vi.fn().mockRejectedValue(new Error("unknown ability 999/Q/0")),
    } as unknown as Partial<LolImageService>);
    const res = makeRes();
    await controller.ability("999", "Q", "0", res as never);
    expect(res._status).toBe(404);
    expect(upstream.fetchUpstreamChain).not.toHaveBeenCalled();
  });

  it("proxies through fetchUpstreamChain + transcodeToWebp for a valid ability", async () => {
    const res = makeRes();
    await makeController().ability("103", "Q", "1", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
    expect(upstream.transcodeToWebp).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });
});

describe("ImgController.map", () => {
  it("returns 400 when mapId is non-numeric", async () => {
    const res = makeRes();
    await makeController().map("abc", res as never);
    expect(res._status).toBe(400);
  });

  it("returns 404 when the resolver throws (unknown mapId)", async () => {
    const controller = makeController({
      map: vi.fn().mockImplementation(() => {
        throw new Error("unknown mapId 999");
      }),
    } as unknown as Partial<LolImageService>);
    const res = makeRes();
    await controller.map("999", res as never);
    expect(res._status).toBe(404);
    expect(upstream.fetchUpstreamChain).not.toHaveBeenCalled();
  });

  it("proxies through the chain for a valid mapId", async () => {
    const res = makeRes();
    await makeController().map("11", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });
});

describe("ImgController.rankEmblem", () => {
  it("returns 400 when year is non-numeric", async () => {
    const res = makeRes();
    await makeController().rankEmblem("GOLD", "abc", res as never);
    expect(res._status).toBe(400);
  });

  it("proxies through the chain for a valid tier + year", async () => {
    const res = makeRes();
    await makeController().rankEmblem("GOLD", "2023", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
  });
});

describe("ImgController.uiIcon", () => {
  it("returns 400 for an unknown UI icon name", async () => {
    const res = makeRes();
    await makeController().uiIcon("notarealicon", res as never);
    expect(res._status).toBe(400);
  });

  it.each([["gold"], ["minion"], ["ward"], ["attack"]])(
    "proxies the chain for the '%s' icon",
    async (name) => {
      const res = makeRes();
      await makeController().uiIcon(name, res as never);
      expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
    }
  );
});

describe("ImgController.role", () => {
  it("returns 400 for an unknown role slug", async () => {
    const res = makeRes();
    await makeController().role("notarole", res as never);
    expect(res._status).toBe(400);
  });

  it("proxies through fetchUpstreamChain + transcodeToWebp for a valid role", async () => {
    const res = makeRes();
    await makeController().role("middle", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
    expect(upstream.transcodeToWebp).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it("returns 502 when the upstream chain throws an UpstreamError", async () => {
    fetchChainSpy.mockRejectedValueOnce(
      new upstream.UpstreamError("https://up", new Error("role upstreams dead"))
    );
    const res = makeRes();
    await makeController().role("middle", res as never);
    expect(res._status).toBe(502);
  });
});

describe("ImgController.champClass", () => {
  it("returns 400 for an unknown class slug", async () => {
    const res = makeRes();
    await makeController().champClass("notaclass", res as never);
    expect(res._status).toBe(400);
  });

  it("proxies through fetchUpstreamChain + transcodeToWebp for a valid class", async () => {
    const res = makeRes();
    await makeController().champClass("mage", res as never);
    expect(upstream.fetchUpstreamChain).toHaveBeenCalled();
    expect(upstream.transcodeToWebp).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });
});

describe("ImgController.steamDescriptionAsset", () => {
  const HASH = "b2d503549e33e6603c86b6bd7babdb38";

  function makeBody() {
    return { pipe: vi.fn() } as unknown as ReturnType<
      typeof upstream.streamUpstream
    > extends Promise<infer R>
      ? R extends { body: infer B }
        ? B
        : never
      : never;
  }

  it("returns 400 for a non-numeric appid", async () => {
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "abc",
      `${HASH}.webm`,
      undefined,
      res as never
    );
    expect(res._status).toBe(400);
    expect(streamSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for a zero appid", async () => {
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "0",
      `${HASH}.webm`,
      undefined,
      res as never
    );
    expect(res._status).toBe(400);
  });

  it("returns 400 when the asset name doesn't match the hash pattern", async () => {
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "1245620",
      "../../../../etc/passwd",
      undefined,
      res as never
    );
    expect(res._status).toBe(400);
    expect(streamSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when the extension isn't on the allowlist", async () => {
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "1245620",
      `${HASH}.gif`,
      undefined,
      res as never
    );
    expect(res._status).toBe(400);
  });

  it("streams a .webm with 200 + Accept-Ranges and pipes to res", async () => {
    const body = makeBody();
    streamSpy.mockResolvedValueOnce({
      status: 200,
      contentType: "video/webm",
      contentLength: "12345",
      contentRange: null,
      acceptRanges: "bytes",
      body,
    });
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "1245620",
      `${HASH}.webm`,
      undefined,
      res as never
    );
    expect(streamSpy).toHaveBeenCalledWith(
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${HASH}.webm`,
      undefined
    );
    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toBe("video/webm");
    expect(res._headers["Accept-Ranges"]).toBe("bytes");
    expect(res._headers["Content-Length"]).toBe("12345");
    expect(res._headers["Content-Range"]).toBeUndefined();
    expect(
      (body as unknown as { pipe: ReturnType<typeof vi.fn> }).pipe
    ).toHaveBeenCalledWith(res);
  });

  it("forwards the Range header and relays a 206 with Content-Range", async () => {
    const body = makeBody();
    streamSpy.mockResolvedValueOnce({
      status: 206,
      contentType: "video/webm",
      contentLength: "1024",
      contentRange: "bytes 0-1023/12345",
      acceptRanges: "bytes",
      body,
    });
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "1245620",
      `${HASH}.webm`,
      "bytes=0-1023",
      res as never
    );
    expect(streamSpy).toHaveBeenCalledWith(expect.any(String), "bytes=0-1023");
    expect(res._status).toBe(206);
    expect(res._headers["Content-Range"]).toBe("bytes 0-1023/12345");
  });

  it("streams a .poster.avif under the same route", async () => {
    const body = makeBody();
    streamSpy.mockResolvedValueOnce({
      status: 200,
      contentType: "image/avif",
      contentLength: "5000",
      contentRange: null,
      acceptRanges: "bytes",
      body,
    });
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "1245620",
      `${HASH}.poster.avif`,
      undefined,
      res as never
    );
    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toBe("image/avif");
  });

  it("returns 502 when upstream throws an UpstreamError", async () => {
    streamSpy.mockRejectedValueOnce(
      new upstream.UpstreamError("https://up", new Error("dead"))
    );
    const res = makeRes();
    await makeController().steamDescriptionAsset(
      "1245620",
      `${HASH}.webm`,
      undefined,
      res as never
    );
    expect(res._status).toBe(502);
  });
});
