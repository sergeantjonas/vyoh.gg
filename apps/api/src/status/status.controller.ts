import { Controller, Get, type MessageEvent, Post, Sse, UseGuards } from "@nestjs/common";
import type { StatusSnapshot, SyncStatus, SyncTriggerResult } from "@vyoh/shared";
import {
  type Observable,
  from,
  interval,
  map,
  merge,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";
import { OwnerGuard } from "../auth/owner.guard";
import { MatchEventsService } from "../lol/match-events.service";
import { MatchSyncService } from "../lol/match-sync.service";
import { RateLimiterService } from "../riot/rate-limiter.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";

const SSE_HEARTBEAT_MS = 30_000;
const SSE_SNAPSHOT_INTERVAL_MS = 2_000;

@Controller("status")
export class StatusController {
  // Built once and shared, not per subscriber. RxJS observables are cold, so
  // the previous shape — constructing the interval inside the handler — gave
  // every connection its own 2-second timer and its own `snapshot()`, and each
  // snapshot awaits `currentReservoir()` across every regional and per-method
  // limiter. A thousand held connections meant ~500 full snapshots a second,
  // on a route that takes no parameters, has no allowlist, and may sit open
  // for the hour nginx's read timeout allows.
  //
  // `refCount: true` matters as much as the sharing: it stops the timer when
  // the last client disconnects, so an idle box does no polling at all, and
  // restarts it on the next subscriber. The replay buffer resets with it, so a
  // fresh connection cannot be handed a stale snapshot — `startWith(0)` then
  // gives it a current one immediately rather than after a 2-second wait.
  private readonly shared$: Observable<MessageEvent>;

  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly matchSync: MatchSyncService,
    private readonly events: MatchEventsService,
    private readonly syncJobs: SyncJobRegistry
  ) {
    const snapshots: Observable<MessageEvent> = interval(SSE_SNAPSHOT_INTERVAL_MS).pipe(
      startWith(0),
      switchMap(() => from(this.snapshot())),
      map((data) => ({ type: "snapshot", data }))
    );

    const heartbeat: Observable<MessageEvent> = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({ type: "heartbeat", data: {} satisfies object }))
    );

    this.shared$ = merge(snapshots, heartbeat).pipe(
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  @Get()
  async snapshot(): Promise<StatusSnapshot> {
    return {
      sync: this.matchSync.getStatus(),
      jobs: this.syncJobs.getStatus(),
      rateLimiter: await this.rateLimiter.getSnapshot(),
    };
  }

  // The three writes below are owner-only; the reads above and the stream below
  // stay public. Each carries its own `@UseGuards` rather than one decorator on
  // the class, because a class-level guard would also close `@Get()` and the SSE
  // stream, and the status dashboard is meant to be readable by anyone.
  @Post("sync")
  @UseGuards(OwnerGuard)
  triggerSync(): SyncTriggerResult {
    return this.matchSync.triggerNow();
  }

  @Post("sync/pause")
  @UseGuards(OwnerGuard)
  pauseSync(): SyncStatus {
    return this.matchSync.setEnabled(false);
  }

  @Post("sync/resume")
  @UseGuards(OwnerGuard)
  resumeSync(): SyncStatus {
    return this.matchSync.setEnabled(true);
  }

  // SSE stream emits:
  // - "snapshot" every 2 s (reservoir + counts shift quickly under load)
  // - "tick" when a sync tick completes (rare event, ~every 5 min)
  // - "heartbeat" every 30 s so idle proxies don't drop the connection
  @Sse("stream")
  stream(): Observable<MessageEvent> {
    // Ticks stay per-subscriber: `forSyncTick()` is already a multicast Subject,
    // so subscribing costs an observer entry rather than a timer or a query.
    const ticks: Observable<MessageEvent> = this.events
      .forSyncTick()
      .pipe(map((tick) => ({ type: "tick", data: tick })));

    return merge(this.shared$, ticks);
  }
}
