import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nestjs";
import { SteamRateLimiterTimeoutError } from "./steam/client/rate-limiter.service";
import { SteamClientError } from "./steam/client/steam-client.service";

type ErrorBody = { statusCode: number; message: string };

type Verdict = {
  status: number;
  body: unknown;
  // What the log line says, or nothing for a deliberate 4xx — those are the
  // handler's own answer and logging them would only bury the real failures.
  log?: { level: "warn" | "error"; line: string };
};

// Everything the Riot filter does not claim. Nest checks global filters in
// reverse registration order and stops at the first match, so this catch-all
// is registered *before* `RiotExceptionFilter` in main.ts — the specific
// filter still wins because it is checked first.
//
// Two jobs: give every failure the same `{ statusCode, message }` body the
// Riot filter already produces, and make sure an unexpected throw is logged
// with its stack instead of vanishing into Nest's default 500.
@Catch()
export class FallbackExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FallbackExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ method?: string; url?: string }>();
    const response = ctx.getResponse<{
      headersSent?: boolean;
      setHeader: (name: string, value: string) => void;
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    const route = `${request.method ?? "?"} ${request.url ?? "?"}`;
    const verdict = classify(exception, route);
    if (verdict.log) this.logger[verdict.log.level](verdict.log.line);
    // Report what is ours to fix, and nothing else. `verdict.log` is absent for
    // a deliberate 4xx — the handler's own answer. The *level* is not the
    // signal: upstream 5xx, rate-limiter timeouts and every Steam failure log
    // at `warn`, so filtering on level would drop exactly what is worth paging
    // on. The route is a tag rather than a message so events group by shape;
    // it can carry a query string, which `beforeSend` scrubs.
    if (verdict.log && verdict.status >= 500) {
      Sentry.captureException(exception, { tags: { route } });
    }
    // A throw after the headers are out (a streaming route mid-stream) has no
    // response left to shape; writing would only raise a second error.
    if (response.headersSent) return;
    // The image and OG routes declare an image Content-Type up front, and
    // Express's `res.json` leaves an existing header alone — without this a
    // JSON error body would go out labelled `image/webp`.
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.status(verdict.status).json(verdict.body);
  }
}

function classify(exception: unknown, route: string): Verdict {
  // Nest's own exceptions already carry a status and a body; `NotFoundException("…")`
  // keeps its `{ statusCode, error, message }` shape by passing through unchanged.
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body = typeof raw === "string" ? { statusCode: status, message: raw } : raw;
    return status >= 500
      ? {
          status,
          body,
          log: { level: "warn", line: `${status} on ${route}: ${exception.message}` },
        }
      : { status, body };
  }

  if (exception instanceof SteamRateLimiterTimeoutError) {
    return reply(503, "Upstream rate limit saturated — please retry in a moment", {
      level: "warn",
      line: `Steam limiter on ${route}: ${exception.message}`,
    });
  }

  // Mirrors the Riot filter's mapping: the statuses a client can act on pass
  // through, everything else is the upstream's fault and says so.
  if (exception instanceof SteamClientError) {
    const log = {
      level: "warn" as const,
      line: `Steam ${exception.status} on ${exception.path}: ${exception.message}`,
    };
    if (exception.status === 404) return reply(404, "Steam resource not found", log);
    if (exception.status === 429)
      return reply(429, "Rate limit exceeded — try again shortly", log);
    if (exception.status === 504)
      return reply(504, "Steam API timed out — please retry", log);
    return reply(502, "Upstream service error", log);
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025 is "record required but not found" — a lookup miss, not a fault.
    // P2002 is a unique-constraint hit. Any other code is ours to fix.
    if (exception.code === "P2025") return reply(404, "Not found");
    if (exception.code === "P2002") return reply(409, "Already exists");
    return reply(500, "Internal server error", {
      level: "error",
      line: `Prisma ${exception.code} on ${route}: ${exception.message}`,
    });
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return reply(503, "Database unavailable", {
      level: "error",
      line: `Prisma init on ${route}: ${exception.message}`,
    });
  }

  const detail =
    exception instanceof Error
      ? (exception.stack ?? exception.message)
      : String(exception);
  return reply(500, "Internal server error", {
    level: "error",
    line: `Unhandled on ${route}: ${detail}`,
  });
}

function reply(status: number, message: string, log?: Verdict["log"]): Verdict {
  const body: ErrorBody = { statusCode: status, message };
  return log ? { status, body, log } : { status, body };
}
