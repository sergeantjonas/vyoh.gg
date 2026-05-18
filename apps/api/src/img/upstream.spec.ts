import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamError, fetchUpstream, fetchUpstreamChain } from "./upstream";

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
});
