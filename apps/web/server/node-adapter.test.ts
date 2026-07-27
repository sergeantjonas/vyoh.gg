// @vitest-environment node
//
// Node, not happy-dom: the adapter builds a `Request` with `duplex: "half"` over
// a Node stream, which only the runtime's own fetch primitives accept.

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { type IncomingHttpHeaders, request as httpRequest } from "node:http";
import type { AddressInfo, Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type FetchHandler, createNodeServer } from "./node-adapter.ts";

const ASSET_BODY = "export const marker = 1;\n";

/** Echoes back what the SSR handler was actually handed, so misses are visible. */
const ssrHandler: FetchHandler = async (request) => {
  const { pathname } = new URL(request.url);
  if (pathname === "/boom") throw new Error("handler exploded");
  if (pathname === "/cookies") {
    const headers = new Headers();
    headers.append("set-cookie", "a=1; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    return new Response("ok", { headers });
  }
  const body =
    request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
  return new Response(
    JSON.stringify({ url: request.url, method: request.method, body }),
    {
      headers: { "content-type": "application/json" },
    }
  );
};

interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

let server: Server;
let port: number;

/**
 * A raw client rather than `fetch`, for two reasons: `fetch` normalises `..`
 * out of a path before it reaches the wire, which would quietly defeat every
 * traversal case below, and the suite's global setup blocks network calls
 * through the global.
 */
function send(
  path: string,
  init: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<Reply> {
  return new Promise((settle, fail) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: init.method ?? "GET",
        headers: init.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          settle({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", fail);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

beforeAll(async () => {
  const clientDir = await mkdtemp(join(tmpdir(), "vyoh-client-"));
  await mkdir(join(clientDir, "assets"));
  await mkdir(join(clientDir, ".vite"));
  await writeFile(join(clientDir, "assets", "app-abc123.js"), ASSET_BODY);
  await writeFile(join(clientDir, "robots.txt"), "User-agent: *\n");
  await writeFile(join(clientDir, ".vite", "manifest.json"), '{"secret":"chunk graph"}');

  server = createNodeServer({ fetch: ssrHandler, clientDir });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((done) => server.close(done));
});

describe("static files", () => {
  it("serves a hashed asset as immutable", async () => {
    const res = await send("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(res.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(res.headers["content-length"]).toBe(String(Buffer.byteLength(ASSET_BODY)));
    expect(res.body).toBe(ASSET_BODY);
  });

  it("caches an unhashed public file for an hour, not a year", async () => {
    const res = await send("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    expect(res.body).toBe("User-agent: *\n");
  });

  it("answers HEAD with the headers and no body", async () => {
    const res = await send("/assets/app-abc123.js", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers["content-length"]).toBe(String(Buffer.byteLength(ASSET_BODY)));
    expect(res.body).toBe("");
  });
});

describe("paths that must not reach the filesystem", () => {
  it("does not serve Vite's build manifest", async () => {
    const res = await send("/.vite/manifest.json");
    // Falls through to the app, which renders its own 404 route.
    expect(res.body).not.toContain("chunk graph");
    expect(res.body).toContain("/.vite/manifest.json");
  });

  it.each(["/../package.json", "/%2e%2e/package.json", "/assets/../../package.json"])(
    "does not traverse out of the client directory via %s",
    async (path) => {
      const res = await send(path);
      expect(res.body).not.toContain("packageManager");
      expect(res.body).not.toContain("pnpm");
    }
  );
});

describe("SSR fallthrough", () => {
  it("hands the document path to the handler", async () => {
    const res = await send("/lol/ahri");
    expect(JSON.parse(res.body).url).toContain("/lol/ahri");
  });

  it("hands a missing asset to the handler rather than answering 404 itself", async () => {
    const res = await send("/assets/never-built.js");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).url).toContain("/assets/never-built.js");
  });

  it("forwards a request body", async () => {
    const res = await send("/api/thing", { method: "POST", body: "payload" });
    expect(JSON.parse(res.body)).toMatchObject({ method: "POST", body: "payload" });
  });

  it("builds the request URL from X-Forwarded-Proto", async () => {
    const res = await send("/", { headers: { "x-forwarded-proto": "https" } });
    expect(JSON.parse(res.body).url.startsWith("https://")).toBe(true);
  });

  it("keeps repeated Set-Cookie headers separate", async () => {
    const res = await send("/cookies");
    expect(res.headers["set-cookie"]).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });

  it("answers 500 when the handler throws", async () => {
    const res = await send("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toBe("Internal Server Error");
  });
});
