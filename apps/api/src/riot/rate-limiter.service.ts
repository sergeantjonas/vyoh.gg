import { Injectable } from "@nestjs/common";
import Bottleneck from "bottleneck";
import type { Regional } from "./regions";

const REGIONALS: Regional[] = ["americas", "europe", "asia", "sea"];

@Injectable()
export class RateLimiterService {
  private readonly limiters = new Map<Regional, Bottleneck>();

  constructor() {
    for (const regional of REGIONALS) {
      const fast = new Bottleneck({
        reservoir: 20,
        reservoirRefreshAmount: 20,
        reservoirRefreshInterval: 1_000,
      });
      const slow = new Bottleneck({
        reservoir: 100,
        reservoirRefreshAmount: 100,
        reservoirRefreshInterval: 120_000,
      });
      fast.chain(slow);
      this.limiters.set(regional, fast);
    }
  }

  schedule<T>(regional: Regional, fn: () => Promise<T>): Promise<T> {
    const limiter = this.limiters.get(regional);
    if (!limiter) {
      throw new Error(`No rate limiter for regional cluster ${regional}`);
    }
    return limiter.schedule(fn);
  }
}
