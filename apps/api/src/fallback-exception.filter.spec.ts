import {
  type ArgumentsHost,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nestjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackExceptionFilter } from "./fallback-exception.filter";
import { SteamRateLimiterTimeoutError } from "./steam/client/rate-limiter.service";
import { SteamClientError } from "./steam/client/steam-client.service";

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn() }));

function makeHost(headersSent = false) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const setHeader = vi.fn();
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: "GET", url: "/steam/game/42" }),
      getResponse: () => ({ headersSent, setHeader, status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, setHeader };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("db said no", { code, clientVersion: "test" });

describe("FallbackExceptionFilter", () => {
  const filter = new FallbackExceptionFilter();
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("passes a Nest HttpException through with its own status and body, unlogged", () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new NotFoundException("Steam app 42 is not in the tracked library."),
      host
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: "Not Found",
      message: "Steam app 42 is not in the tracked library.",
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("wraps a string-bodied HttpException in the shared shape", () => {
    const { host, status, json } = makeHost();
    filter.catch(new HttpException("plain text", 400), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ statusCode: 400, message: "plain text" });
  });

  it("labels the error body as JSON even when the route declared an image type", () => {
    const { host, setHeader, json } = makeHost();
    filter.catch(new NotFoundException("no such asset"), host);
    expect(setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json; charset=utf-8"
    );
    expect(setHeader.mock.invocationCallOrder[0]).toBeLessThan(
      json.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("writes nothing once the headers are already out", () => {
    const { host, status, setHeader } = makeHost(true);
    filter.catch(new Error("mid-stream"), host);
    expect(status).not.toHaveBeenCalled();
    expect(setHeader).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it("warns on a deliberate 5xx HttpException but keeps its body", () => {
    const { host, status, json } = makeHost();
    filter.catch(new ServiceUnavailableException("warming up"), host);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
    expect(warn).toHaveBeenCalledOnce();
  });

  it("maps a Steam 404 to 404", () => {
    const { host, status, json } = makeHost();
    filter.catch(new SteamClientError("Steam Web API 404", 404, "/ISteamUser"), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: "Steam resource not found",
    });
  });

  it("maps a Steam 429 to 429", () => {
    const { host, status } = makeHost();
    filter.catch(new SteamClientError("Steam Web API 429", 429, "/ISteamUser"), host);
    expect(status).toHaveBeenCalledWith(429);
  });

  it("maps a Steam fetch timeout to 504", () => {
    const { host, status } = makeHost();
    filter.catch(new SteamClientError("timeout", 504, "/ISteamUser"), host);
    expect(status).toHaveBeenCalledWith(504);
  });

  it("maps any other Steam status to 502 and logs the upstream detail server-side only", () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new SteamClientError("Steam Web API 500 Internal", 500, "/ISteamUser"),
      host
    );
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({
      statusCode: 502,
      message: "Upstream service error",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Steam 500 on /ISteamUser")
    );
  });

  it("maps a saturated Steam limiter to 503 like the Riot filter does", () => {
    const { host, status, json } = makeHost();
    filter.catch(new SteamRateLimiterTimeoutError("store", 5000), host);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      message: "Upstream rate limit saturated — please retry in a moment",
    });
  });

  it("maps a Prisma missing-record error to 404", () => {
    const { host, status, json } = makeHost();
    filter.catch(prismaError("P2025"), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, message: "Not found" });
    expect(error).not.toHaveBeenCalled();
  });

  it("maps a Prisma unique-constraint error to 409", () => {
    const { host, status } = makeHost();
    filter.catch(prismaError("P2002"), host);
    expect(status).toHaveBeenCalledWith(409);
  });

  it("answers 503 when the database itself is unreachable", () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new Prisma.PrismaClientInitializationError("ECONNREFUSED", "test"),
      host
    );
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      message: "Database unavailable",
    });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Prisma init on GET /steam/game/42")
    );
  });

  it("treats any other Prisma error as ours: 500, code logged, message withheld", () => {
    const { host, status, json } = makeHost();
    filter.catch(prismaError("P2010"), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal server error",
    });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Prisma P2010 on GET /steam/game/42")
    );
  });

  it("answers 500 to an unknown throw and logs the stack with the route", () => {
    const { host, status, json } = makeHost();
    const boom = new TypeError("cannot read properties of undefined");
    filter.catch(boom, host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal server error",
    });
    const line = error.mock.calls[0]?.[0] as string;
    expect(line).toContain("Unhandled on GET /steam/game/42");
    expect(line).toContain("cannot read properties of undefined");
    expect(line).toContain("fallback-exception.filter.spec");
  });

  it("copes with a non-Error throw", () => {
    const { host, status, json } = makeHost();
    filter.catch("a string", host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal server error",
    });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("a string"));
  });
});

describe("FallbackExceptionFilter error reporting", () => {
  const filter = new FallbackExceptionFilter();
  const captureException = vi.mocked(Sentry.captureException);

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    captureException.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("reports a 5xx that only logs at warn", () => {
    // The whole point of keying on status rather than log level: every upstream
    // 5xx and every Steam failure logs at `warn`, so a level-based predicate
    // would report none of them.
    filter.catch(new ServiceUnavailableException("upstream down"), makeHost().host);
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("reports an unexpected database failure", () => {
    // Any code the filter does not name is a 500 and ours to fix.
    filter.catch(prismaError("P2010"), makeHost().host);
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("does not report a constraint hit, which the filter answers as 409", () => {
    // P2002 and P2025 are the handler's own answer, not a fault, so they must
    // stay out of the tracker even though they are database errors.
    filter.catch(prismaError("P2002"), makeHost().host);
    filter.catch(prismaError("P2025"), makeHost().host);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("does not report a deliberate 4xx", () => {
    filter.catch(new NotFoundException("no such game"), makeHost().host);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("tags the report with the route so events group by shape", () => {
    filter.catch(new ServiceUnavailableException("upstream down"), makeHost().host);
    expect(captureException.mock.calls[0]?.[1]).toMatchObject({
      tags: { route: "GET /steam/game/42" },
    });
  });
});
