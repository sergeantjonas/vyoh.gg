import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  type IncomingMessage,
  type Server,
  type ServerResponse,
  createServer,
} from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { cacheControlFor, contentTypeFor, resolveClientAsset } from "./static-assets.ts";

/**
 * A `node:http` server over the built Start bundle.
 *
 * `dist/server/server.js` exports a `fetch` handler and does not listen, and it
 * does not serve `dist/client` either — probed 2026-07-27, `/robots.txt`
 * answers 404 through it because the request falls into the SPA catch-all. So
 * both halves of "serve the site" live here: static files first, then the
 * document.
 *
 * Deliberately absent, because Nginx terminates in front of this and does them
 * better: compression, TLS, Range requests, access logging.
 *
 * `server/` belongs to tsconfig.node.json rather than tsconfig.app.json, which
 * is what makes `Request`, `Response` and `ReadableStream` resolve to Node's
 * undici types instead of lib.dom's. `RequestInit.duplex` only exists on the
 * former, and without it the POST path below does not typecheck.
 */

export type FetchHandler = (request: Request) => Response | Promise<Response>;

export interface NodeServerOptions {
  /** The `fetch` export of `dist/server/server.js`. */
  fetch: FetchHandler;
  /** Path to `dist/client`. Resolved to absolute here. */
  clientDir: string;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The container binds loopback only and Nginx is the sole ingress, so its
 * `X-Forwarded-Proto` is trusted. Absent it (a same-box `curl`), `http` is
 * correct rather than a fallback.
 */
function requestOrigin(req: IncomingMessage): string {
  const proto = firstHeader(req.headers["x-forwarded-proto"]) ?? "http";
  const host = firstHeader(req.headers.host) ?? "localhost";
  return `${proto}://${host}`;
}

function toWebRequest(req: IncomingMessage): Request {
  const url = new URL(req.url ?? "/", requestOrigin(req));
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, value);
  }

  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });
  return new Request(url, {
    method,
    headers,
    body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
    // Node hands the body over as it arrives. Without `duplex` the Request
    // constructor rejects a stream it cannot rewind.
    duplex: "half",
  });
}

async function writeWebResponse(
  res: ServerResponse,
  response: Response,
  isHead: boolean
): Promise<void> {
  const headers: Record<string, string | string[]> = Object.fromEntries(response.headers);
  // `Object.fromEntries` folds repeated Set-Cookie into one comma-joined value,
  // which is not a thing a browser can parse back apart.
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;

  res.writeHead(response.status, headers);
  if (isHead || !response.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body as never), res);
}

/**
 * Returns false when the request is not for a file we hold, which includes a
 * miss. The SSR handler then renders the app's 404 route, so a wrong asset URL
 * gets the site's own not-found page rather than a bare status line.
 */
async function serveStatic(
  res: ServerResponse,
  pathname: string,
  clientDir: string,
  isHead: boolean
): Promise<boolean> {
  const file = resolveClientAsset(clientDir, pathname);
  if (file === null) return false;

  let size: number;
  try {
    const stats = await stat(file);
    if (!stats.isFile()) return false;
    size = stats.size;
  } catch {
    return false;
  }

  res.writeHead(200, {
    "content-type": contentTypeFor(file),
    "content-length": String(size),
    "cache-control": cacheControlFor(pathname),
  });
  if (isHead) {
    res.end();
    return true;
  }
  await pipeline(createReadStream(file), res);
  return true;
}

export function createNodeServer({
  fetch: fetchHandler,
  clientDir,
}: NodeServerOptions): Server {
  const root = resolve(clientDir);

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const isHead = req.method === "HEAD";
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (await serveStatic(res, pathname, root, isHead)) return;
    await writeWebResponse(res, await fetchHandler(toWebRequest(req)), isHead);
  }

  return createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      console.error(`[web] ${req.method} ${req.url} failed:`, error);
      if (res.headersSent) {
        // Half a response is already on the wire; the only honest signal left
        // is an incomplete body.
        res.destroy();
        return;
      }
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    });
  });
}
