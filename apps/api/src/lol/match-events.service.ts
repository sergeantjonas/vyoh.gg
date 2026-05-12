import { Injectable } from "@nestjs/common";
import type { SyncTick } from "@vyoh/shared";
import { type Observable, Subject, filter } from "rxjs";

export interface MatchUpdatedEvent {
  puuid: string;
  added: number;
  source: "head" | "historical";
}

export type LiveGameEventType = "game-started" | "game-ended";

export interface LiveGameEvent {
  type: LiveGameEventType;
  puuid: string;
}

// Tiny pub/sub for match-backfill and live-game notifications. Cron/poller
// write events here; the SSE controllers subscribe filtered by puuid and
// forward as MessageEvents to interested clients. Plain Subject (no replay)
// because subscribers only care about events that arrive while connected —
// a late-joining tab reconciles via the cached REST endpoints.
@Injectable()
export class MatchEventsService {
  private readonly matchSubject = new Subject<MatchUpdatedEvent>();
  private readonly liveSubject = new Subject<LiveGameEvent>();
  private readonly syncTickSubject = new Subject<SyncTick>();

  emit(event: MatchUpdatedEvent): void {
    this.matchSubject.next(event);
  }

  forPuuid(puuid: string): Observable<MatchUpdatedEvent> {
    return this.matchSubject.asObservable().pipe(filter((e) => e.puuid === puuid));
  }

  emitLiveGame(event: LiveGameEvent): void {
    this.liveSubject.next(event);
  }

  forLiveGame(puuid: string): Observable<LiveGameEvent> {
    return this.liveSubject.asObservable().pipe(filter((e) => e.puuid === puuid));
  }

  emitSyncTick(tick: SyncTick): void {
    this.syncTickSubject.next(tick);
  }

  forSyncTick(): Observable<SyncTick> {
    return this.syncTickSubject.asObservable();
  }
}
