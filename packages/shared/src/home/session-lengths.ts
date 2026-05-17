/**
 * Cross-stream session-length distribution for `/`. Counts (not minutes) of
 * play sessions per length bucket, split by stream. The surface answers
 * *how* the owner plays — bursts vs. sit-down stretches — not *how much*.
 *
 * LoL sessions are stitched from `Match.playedAt` + `durationSec`: a block of
 * matches whose consecutive gaps are ≤ 30 min collapses into one session.
 * Steam sessions are closed `SteamPlaySession` rows (poller-driven since S6).
 *
 * Buckets are fixed (`<30m`, `30m–1h`, `1h–2h`, `2h–4h`, `4h+`) and ordered
 * shortest → longest so the response can be rendered as a column chart
 * without re-sorting on the web.
 */
export type SessionLengthBucketLabel = "<30m" | "30m–1h" | "1h–2h" | "2h–4h" | "4h+";

export interface HomeSessionLengthsBucket {
  label: SessionLengthBucketLabel;
  lolCount: number;
  steamCount: number;
}

export interface HomeSessionLengths {
  /** Ordered shortest → longest. */
  buckets: HomeSessionLengthsBucket[];
  lolSessionCount: number;
  steamSessionCount: number;
}
