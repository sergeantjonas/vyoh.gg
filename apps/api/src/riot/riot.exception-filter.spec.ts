import type { ArgumentsHost } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RiotError } from "./riot.error";
import { RiotExceptionFilter } from "./riot.exception-filter";

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe("RiotExceptionFilter", () => {
  const filter = new RiotExceptionFilter();

  it("maps 404 to 404 with summoner-not-found message", () => {
    const { host, status, json } = makeHost();
    filter.catch(new RiotError("Riot 404", 404, "/account"), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: "Summoner not found",
    });
  });

  it("maps 429 to 429 with rate-limit message", () => {
    const { host, status, json } = makeHost();
    filter.catch(new RiotError("Riot 429", 429, "/match"), host);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      statusCode: 429,
      message: "Rate limit exceeded — try again shortly",
    });
  });

  it("maps 500 to 502 (bad gateway)", () => {
    const { host, status, json } = makeHost();
    filter.catch(new RiotError("Riot 500", 500, "/match"), host);
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({
      statusCode: 502,
      message: "Upstream service error",
    });
  });

  it("maps 503 to 502", () => {
    const { host, status } = makeHost();
    filter.catch(new RiotError("Riot 503", 503, "/match"), host);
    expect(status).toHaveBeenCalledWith(502);
  });

  it("maps unknown 4xx to 502", () => {
    const { host, status } = makeHost();
    filter.catch(new RiotError("Riot 418", 418, "/match"), host);
    expect(status).toHaveBeenCalledWith(502);
  });
});
