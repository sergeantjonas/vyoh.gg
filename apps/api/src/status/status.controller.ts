import { Controller, Get, type MessageEvent, Post, Sse } from "@nestjs/common";
import type { StatusSnapshot, SyncStatus, SyncTriggerResult } from "@vyoh/shared";
import { type Observable, from, interval, map, merge, startWith, switchMap } from "rxjs";
import { MatchEventsService } from "../lol/match-events.service";
import { MatchSyncService } from "../lol/match-sync.service";
import { RateLimiterService } from "../riot/rate-limiter.service";

const SSE_HEARTBEAT_MS = 30_000;
const SSE_SNAPSHOT_INTERVAL_MS = 2_000;

@Controller("status")
export class StatusController {
  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly matchSync: MatchSyncService,
    private readonly events: MatchEventsService
  ) {}

  @Get()
  async snapshot(): Promise<StatusSnapshot> {
    return {
      sync: this.matchSync.getStatus(),
      rateLimiter: await this.rateLimiter.getSnapshot(),
    };
  }

  @Post("sync")
  triggerSync(): SyncTriggerResult {
    return this.matchSync.triggerNow();
  }

  @Post("sync/pause")
  pauseSync(): SyncStatus {
    return this.matchSync.setEnabled(false);
  }

  @Post("sync/resume")
  resumeSync(): SyncStatus {
    return this.matchSync.setEnabled(true);
  }

  // SSE stream emits:
  // - "snapshot" every 2 s (reservoir + counts shift quickly under load)
  // - "tick" when a sync tick completes (rare event, ~every 5 min)
  // - "heartbeat" every 30 s so idle proxies don't drop the connection
  @Sse("stream")
  stream(): Observable<MessageEvent> {
    // startWith(0) so the first snapshot fires immediately on connect rather
    // than waiting one interval tick — without it the UI shows empty for 2 s.
    const snapshots: Observable<MessageEvent> = interval(SSE_SNAPSHOT_INTERVAL_MS).pipe(
      startWith(0),
      switchMap(() => from(this.snapshot())),
      map((data) => ({ type: "snapshot", data }))
    );

    const ticks: Observable<MessageEvent> = this.events
      .forSyncTick()
      .pipe(map((tick) => ({ type: "tick", data: tick })));

    const heartbeat: Observable<MessageEvent> = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({ type: "heartbeat", data: {} satisfies object }))
    );

    return merge(snapshots, ticks, heartbeat);
  }
}
