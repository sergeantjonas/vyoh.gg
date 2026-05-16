import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { firstValueFrom, of, throwError } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpLoggingInterceptor } from "./http-logging.interceptor";

function makeContext(req: { method: string; url: string }, res: { statusCode: number }) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe("HttpLoggingInterceptor", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("logs method, url, status, and duration on success", async () => {
    const interceptor = new HttpLoggingInterceptor();
    const ctx = makeContext({ method: "GET", url: "/health" }, { statusCode: 200 });
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(interceptor.intercept(ctx, handler));

    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls[0]?.[0]).toMatch(/^GET \/health → 200 \(\d+ms\)$/);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns with the error message when the downstream handler throws", async () => {
    const interceptor = new HttpLoggingInterceptor();
    const ctx = makeContext({ method: "POST", url: "/boom" }, { statusCode: 500 });
    const handler: CallHandler = {
      handle: () => throwError(() => new Error("upstream failed")),
    };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toThrow(
      "upstream failed"
    );

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(
      /^POST \/boom → ERROR \(\d+ms\): upstream failed$/
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("coerces non-Error throw values to a string in the warn line", async () => {
    const interceptor = new HttpLoggingInterceptor();
    const ctx = makeContext({ method: "GET", url: "/odd" }, { statusCode: 500 });
    const handler: CallHandler = { handle: () => throwError(() => "weird string") };

    await expect(firstValueFrom(interceptor.intercept(ctx, handler))).rejects.toBe(
      "weird string"
    );
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/: weird string$/);
  });
});
