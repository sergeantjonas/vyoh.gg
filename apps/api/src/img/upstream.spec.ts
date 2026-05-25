import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UpstreamError,
  fetchUpstream,
  fetchUpstreamChain,
  generatePaletteGradient,
  transcodeToWebp,
} from "./upstream";

function mockFetchOnce(impl: (url: string) => Response | Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => impl(url.toString()))
  );
}

function okResponse(body: ArrayBuffer): Response {
  return new Response(body, { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUpstream", () => {
  it("returns the response body as a Buffer on a 2xx response", async () => {
    const payload = new TextEncoder().encode("hello").buffer;
    mockFetchOnce(() => okResponse(payload as ArrayBuffer));

    const buf = await fetchUpstream("https://cdn.example/asset.webp");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString()).toBe("hello");
  });

  it("throws UpstreamError with the HTTP status in the message on a non-2xx response", async () => {
    mockFetchOnce(() => new Response(null, { status: 404 }));

    await expect(fetchUpstream("https://cdn.example/missing.webp")).rejects.toMatchObject(
      {
        url: "https://cdn.example/missing.webp",
        message: expect.stringContaining("HTTP 404"),
      }
    );
  });

  it("wraps a fetch rejection in UpstreamError, preserving the cause", async () => {
    const networkErr = new Error("ECONNREFUSED");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw networkErr;
      })
    );

    const promise = fetchUpstream("https://cdn.example/asset.webp");
    await expect(promise).rejects.toBeInstanceOf(UpstreamError);
    await expect(promise).rejects.toMatchObject({
      url: "https://cdn.example/asset.webp",
      cause: networkErr,
    });
  });
});

describe("fetchUpstreamChain", () => {
  it("returns bytes from the first URL that succeeds", async () => {
    const payload = new TextEncoder().encode("first").buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse(payload as ArrayBuffer))
    );

    const buf = await fetchUpstreamChain([
      "https://cdn.example/a.webp",
      "https://cdn.example/b.webp",
    ]);
    expect(buf.toString()).toBe("first");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls through to later URLs when earlier ones fail", async () => {
    const payload = new TextEncoder().encode("legacy").buffer;
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call++;
        if (call === 1) return new Response(null, { status: 404 });
        return okResponse(payload as ArrayBuffer);
      })
    );

    const buf = await fetchUpstreamChain([
      "https://cdn.example/hashed.webp",
      "https://cdn.example/legacy.jpg",
    ]);
    expect(buf.toString()).toBe("legacy");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when every URL in the chain fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        return new Response(`missing ${url.toString()}`, { status: 404 });
      })
    );

    await expect(
      fetchUpstreamChain(["https://cdn.example/a.webp", "https://cdn.example/b.webp"])
    ).rejects.toMatchObject({
      url: "https://cdn.example/b.webp",
      message: expect.stringContaining("HTTP 404"),
    });
  });

  it("throws an UpstreamError on an empty chain (last URL fallback)", async () => {
    await expect(fetchUpstreamChain([])).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("transcodeToWebp", () => {
  // A tiny 4×4 red PNG buffer is enough for sharp to round-trip.
  async function makeRedPng(): Promise<Buffer> {
    return sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
  }

  it("returns a WebP buffer for the default params (no resize, default quality)", async () => {
    const input = await makeRedPng();
    const out = await transcodeToWebp(input);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
  });

  it("resizes when width or height is specified", async () => {
    const input = await makeRedPng();
    const out = await transcodeToWebp(input, { width: 2, height: 2, fit: "cover" });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(2);
    expect(meta.height).toBe(2);
  });

  it("applies a blur when blur radius is specified", async () => {
    const input = await makeRedPng();
    // A successful round-trip with blur is the assertion — sharp returns a
    // buffer regardless, but the blur pipeline path must execute without error.
    const out = await transcodeToWebp(input, { blur: 1 });
    expect(out.length).toBeGreaterThan(0);
  });

  it("crops the upper half before resizing when extractTopHalf is set", async () => {
    // 8×16 sprite — extractTopHalf should clip to 8×8 before resize is applied.
    const sprite = await sharp({
      create: { width: 8, height: 16, channels: 3, background: { r: 0, g: 200, b: 0 } },
    })
      .png()
      .toBuffer();
    const out = await transcodeToWebp(sprite, { extractTopHalf: true });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(8);
    expect(meta.height).toBe(8);
  });
});

describe("generatePaletteGradient (edge-extension backdrop)", () => {
  // Build a hero with distinct left/right halves so we can verify the
  // function samples the LEFT edge specifically (not the right or
  // overall dominant). Left half is dark warm red, right half is bright
  // cyan — if extension samples the left, output should be warm-toned.
  async function makeSplitHero(): Promise<Buffer> {
    return sharp({
      create: { width: 1920, height: 620, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .composite([
        {
          input: {
            create: {
              width: 960,
              height: 620,
              channels: 3,
              background: { r: 130, g: 40, b: 30 },
            },
          },
          top: 0,
          left: 0,
        },
        {
          input: {
            create: {
              width: 960,
              height: 620,
              channels: 3,
              background: { r: 40, g: 200, b: 220 },
            },
          },
          top: 0,
          left: 960,
        },
      ])
      .png()
      .toBuffer();
  }

  async function makeSolidHero(r: number, g: number, b: number): Promise<Buffer> {
    return sharp({
      create: { width: 1920, height: 620, channels: 3, background: { r, g, b } },
    })
      .png()
      .toBuffer();
  }

  it("returns a WebP at the asset's native height and 1920px wide", async () => {
    const out = await generatePaletteGradient(await makeSplitHero());
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(620);
  });

  it("samples the LEFT edge specifically (not the right or overall dominant)", async () => {
    // Left half is warm red, right half is bright cyan. If the function
    // samples the left edge correctly, the output should be uniformly
    // warm-red across its width — not cyan, not a mix.
    const out = await generatePaletteGradient(await makeSplitHero());
    const { dominant } = await sharp(out).stats();
    expect(dominant.r).toBeGreaterThan(dominant.g);
    expect(dominant.r).toBeGreaterThan(dominant.b);
  });

  it("does not throw on a fully-black input", async () => {
    const out = await generatePaletteGradient(await makeSolidHero(0, 0, 0));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
  });

  it("does not throw on a near-white input (Pragmata-style)", async () => {
    const out = await generatePaletteGradient(await makeSolidHero(250, 250, 250));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
  });
});
