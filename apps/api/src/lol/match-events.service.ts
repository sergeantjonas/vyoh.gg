import { Injectable } from "@nestjs/common";
import { type Observable, Subject, filter } from "rxjs";

export interface MatchUpdatedEvent {
  puuid: string;
  added: number;
  source: "head" | "historical";
}

// Tiny pub/sub for backfill notifications. The cron writes events here
// after each successful step; the SSE controller subscribes filtered by
// puuid and forwards as MessageEvents to interested clients. We use a
// plain Subject (no replay) because subscribers only care about events
// that happen while they're connected — a late-joining tab can refetch
// from the cached endpoint to reconcile.
@Injectable()
export class MatchEventsService {
  private readonly subject = new Subject<MatchUpdatedEvent>();

  emit(event: MatchUpdatedEvent): void {
    this.subject.next(event);
  }

  forPuuid(puuid: string): Observable<MatchUpdatedEvent> {
    return this.subject.asObservable().pipe(filter((e) => e.puuid === puuid));
  }
}
