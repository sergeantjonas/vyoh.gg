import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import type { ParticipantDetail, ScoreOfGame } from "@vyoh/shared";
import { m } from "motion/react";
import { ParticipantRow } from "./participant-row";
import { teamContainer } from "./recap-motion";

export function TeamBlock({
  title,
  participants,
  myPuuid,
  maxDamage,
  maxGold,
  badges,
  grades,
  goldLead,
  accountSlug,
  skipAnimation,
  matchQueueId,
  matchDurationSec,
}: {
  title: string;
  participants: ParticipantDetail[];
  myPuuid?: string | undefined;
  maxDamage: number;
  maxGold: number;
  badges: Map<string, { label: string; tip: string }>;
  grades: Map<string, ScoreOfGame>;
  goldLead: number;
  accountSlug: string;
  skipAnimation?: boolean | undefined;
  matchQueueId: number;
  matchDurationSec: number;
}) {
  const win = participants[0]?.win ?? false;
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle className="flex items-baseline gap-2">
        <span>{title}</span>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            win ? "text-emerald-400" : "text-red-400"
          )}
        >
          {win ? "Win" : "Loss"}
        </span>
        {goldLead !== 0 && (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              goldLead > 0 ? "text-amber-400/70" : "text-muted-foreground/50"
            )}
          >
            {goldLead > 0 ? "+" : ""}
            {(goldLead / 1000).toFixed(1)}k gold
          </span>
        )}
      </SectionTitle>
      <m.ul
        initial={skipAnimation ? "show" : "hidden"}
        animate="show"
        variants={teamContainer}
        className="flex flex-col gap-2"
      >
        {participants.map((p) => (
          <ParticipantRow
            key={p.puuid}
            p={p}
            isMe={p.puuid === myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
            badge={badges.get(p.puuid)}
            grade={grades.get(p.puuid)}
            accountSlug={accountSlug}
            skipAnimation={skipAnimation}
            matchQueueId={matchQueueId}
            matchDurationSec={matchDurationSec}
          />
        ))}
      </m.ul>
    </section>
  );
}
