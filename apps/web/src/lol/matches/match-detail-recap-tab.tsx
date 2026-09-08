import {
  type MatchDetail,
  REMAKE_DURATION_S,
  type ScoreOfGame,
  scoreOfGame,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { MatchHeaderStrip } from "./recap/match-header-strip";
import { computeBadges } from "./recap/recap-badges";
import { TeamBlock } from "./recap/team-block";

// Tracks which matchId recap tabs have already played their entry animations.
// Cleared only on full page reload — tab switches within a session skip re-animating.
const recapSeen = new Set<string>();

export function MatchRecapTab({
  detail,
  myPuuid,
  accountSlug,
}: {
  detail: MatchDetail;
  myPuuid?: string | undefined;
  accountSlug: string;
}) {
  const reduced = useReducedMotion();
  const skip = reduced || recapSeen.has(detail.matchId);
  useEffect(() => {
    recapSeen.add(detail.matchId);
  }, [detail.matchId]);

  const blue = detail.participants.filter((p) => p.teamId === 100);
  const red = detail.participants.filter((p) => p.teamId === 200);
  const maxDamage = Math.max(...detail.participants.map((p) => p.totalDamage), 1);
  const maxGold = Math.max(...detail.participants.map((p) => p.goldEarned), 1);
  const badges = computeBadges(detail.participants);
  // A remake has no game to grade; MatchDetail carries no surrender flag, so
  // the duration bound alone stands in for isRemakeMatch here.
  const grades =
    detail.durationSec < REMAKE_DURATION_S
      ? new Map<string, ScoreOfGame>()
      : scoreOfGame(detail.participants);
  const blueGold = detail.teams.find((t) => t.teamId === 100)?.totalGold ?? 0;
  const redGold = detail.teams.find((t) => t.teamId === 200)?.totalGold ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <MatchHeaderStrip matchId={detail.matchId} teams={detail.teams} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Skip the entrance opacity animation — it created an ancestor
            stacking context that suppressed `backdrop-filter` painting on
            the bg-card/60 cards inside (TeamBlock player rows) until the
            spring settled. Translate is still animated on the row level
            via `teamRow` variants; that's enough motion signal without
            blocking the frosted effect on descendants. */}
        <m.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <TeamBlock
            title="Blue side"
            participants={blue}
            myPuuid={myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
            badges={badges}
            grades={grades}
            goldLead={blueGold - redGold}
            accountSlug={accountSlug}
            skipAnimation={skip}
            matchQueueId={detail.queueId}
            matchDurationSec={detail.durationSec}
          />
        </m.div>
        <m.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <TeamBlock
            title="Red side"
            participants={red}
            myPuuid={myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
            badges={badges}
            grades={grades}
            goldLead={redGold - blueGold}
            accountSlug={accountSlug}
            skipAnimation={skip}
            matchQueueId={detail.queueId}
            matchDurationSec={detail.durationSec}
          />
        </m.div>
      </div>
    </div>
  );
}
