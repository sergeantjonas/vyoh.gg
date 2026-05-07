export class RiotError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "RiotError";
    this.status = status;
    this.path = path;
  }
}

export class RateLimiterTimeoutError extends RiotError {
  readonly waitedMs: number;

  constructor(regional: string, family: string, waitedMs: number) {
    super(
      `Rate limiter deadline exceeded after ${waitedMs}ms on ${regional}:${family}`,
      503,
      `${regional}:${family}`
    );
    this.name = "RateLimiterTimeoutError";
    this.waitedMs = waitedMs;
  }
}
