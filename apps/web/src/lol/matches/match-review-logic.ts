import type { MatchSummary, ParticipantOwnerExtras, TeamSummary } from "@vyoh/shared";
import {
  Crosshair,
  Flame,
  HeartPulse,
  type LucideIcon,
  Swords,
  Timer,
  Users,
  Zap,
} from "lucide-react";

export type HighlightChip = {
  Icon: LucideIcon;
  label: string;
  description: string;
  tone: "positive" | "survival" | "cc";
};

export type GoldPoint = { min: number; diff: number };

export type VerdictTone = "positive" | "neutral" | "warning";
export type VerdictResult = { verdict: string; tone: VerdictTone };

export function buildHighlightChips(owner: ParticipantOwnerExtras): HighlightChip[] {
  const chips: HighlightChip[] = [];
  const { multikills, challenges, survival } = owner;

  if (multikills.penta >= 1) {
    chips.push({
      Icon: Swords,
      label: multikills.penta === 1 ? "Pentakill" : `${multikills.penta}× Pentakill`,
      description: "Killed all 5 enemies consecutively without dying",
      tone: "positive",
    });
  }
  if (multikills.quadra >= 1) {
    chips.push({
      Icon: Swords,
      label: `${multikills.quadra}× quadra kill`,
      description: "Killed 4 enemies in quick succession",
      tone: "positive",
    });
  }
  if (multikills.triple >= 1) {
    chips.push({
      Icon: Swords,
      label: `${multikills.triple}× triple kill`,
      description: "Killed 3 enemies in quick succession",
      tone: "positive",
    });
  }
  const soloKills = challenges.soloKills ?? 0;
  if (soloKills >= 1) {
    chips.push({
      Icon: Crosshair,
      label: `${soloKills} solo kill${soloKills > 1 ? "s" : ""}`,
      description: "Kills earned without your team nearby",
      tone: "positive",
    });
  }
  const outnumbered = challenges.outnumberedKills ?? 0;
  if (outnumbered >= 1) {
    chips.push({
      Icon: Users,
      label: `${outnumbered} vs. outnumbered`,
      description: "Kills scored while 2 or more enemies were present",
      tone: "positive",
    });
  }
  if (multikills.largestKillingSpree >= 3) {
    chips.push({
      Icon: Flame,
      label: `${multikills.largestKillingSpree}-kill spree`,
      description: "Most consecutive kills you had without dying",
      tone: "positive",
    });
  }
  const clutches = challenges.survivedSingleDigitHpCount ?? 0;
  if (clutches >= 1) {
    chips.push({
      Icon: HeartPulse,
      label: `${clutches} clutch${clutches > 1 ? "es" : ""}`,
      description: "Survived with less than 10% health",
      tone: "survival",
    });
  }
  if (survival.longestTimeSpentLiving >= 300) {
    const minutes = Math.floor(survival.longestTimeSpentLiving / 60);
    chips.push({
      Icon: Timer,
      label: `${minutes}m streak`,
      description: "Your longest uninterrupted stretch without dying",
      tone: "survival",
    });
  }
  const immob = challenges.enemyChampionImmobilizations ?? 0;
  if (immob >= 20) {
    chips.push({
      Icon: Zap,
      label: `${immob} immobilizations`,
      description: "Times you rooted, stunned, or hard-CC'd an enemy",
      tone: "cc",
    });
  }
  return chips;
}

export function getLaningVerdict(
  summary: MatchSummary,
  challenges: ParticipantOwnerExtras["challenges"] | undefined
): VerdictResult {
  const pos = summary.teamPosition;
  if (pos === "JUNGLE")
    return { verdict: "No lane phase — jungle champion.", tone: "neutral" };
  if (pos === "UTILITY")
    return { verdict: "Support — CS isn't the read.", tone: "neutral" };

  const maxCs = challenges?.maxCsAdvantageOnLaneOpponent ?? 0;
  const maxLevel = challenges?.maxLevelLeadLaneOpponent ?? 0;

  if (maxCs >= 25 || maxLevel >= 3) {
    return {
      verdict: `Stomped lane — peaked at +${Math.round(maxCs)} CS over your opponent.`,
      tone: "positive",
    };
  }
  if (maxCs >= 12 || maxLevel >= 2) {
    return {
      verdict: `Won lane — +${Math.round(maxCs)} CS peak advantage.`,
      tone: "positive",
    };
  }
  if (summary.csAt10 >= 62) {
    return { verdict: `Even lane — ${summary.csAt10} CS at 10 min.`, tone: "neutral" };
  }
  return { verdict: `Tough lane — ${summary.csAt10} CS at 10 min.`, tone: "warning" };
}

export function getMidVerdict(
  series: GoldPoint[],
  deathTimings: number[]
): VerdictResult {
  const midPoints = series.filter((p) => p.min >= 14 && p.min <= 25);
  if (midPoints.length < 2)
    return { verdict: "Short game — no mid phase.", tone: "neutral" };

  const first = midPoints.at(0);
  const last = midPoints.at(-1);
  if (!first || !last) return { verdict: "Short game — no mid phase.", tone: "neutral" };
  const trend = last.diff - first.diff;
  const midDeaths = deathTimings.filter((t) => t >= 840 && t <= 1500).length;
  const d = (n: number) => (n === 1 ? "1 death" : `${n} deaths`);

  const aheadAt14 = first.diff > 500;
  const aheadAt25 = last.diff > 500;

  if (aheadAt14 && aheadAt25) {
    if (trend >= 1000)
      return { verdict: "Extended the lead through mid.", tone: "positive" };
    return {
      verdict: `Held the lead through mid${midDeaths > 0 ? ` — ${d(midDeaths)}` : ""}.`,
      tone: "positive",
    };
  }
  if (aheadAt14 && !aheadAt25) {
    return {
      verdict: `Lost the lead mid — ${d(midDeaths)} in the 14–25 window.`,
      tone: "warning",
    };
  }
  if (!aheadAt14 && aheadAt25) {
    return {
      verdict: "Clawed back mid — reversed a deficit before 25.",
      tone: "positive",
    };
  }
  if (!aheadAt14 && !aheadAt25) {
    if (trend >= 2000) return { verdict: "Closing the gap in mid.", tone: "positive" };
    return {
      verdict: `Struggled mid${midDeaths > 0 ? ` — ${d(midDeaths)}` : ""}.`,
      tone: "warning",
    };
  }
  return { verdict: "Even mid game.", tone: "neutral" };
}

export function getLateVerdict(
  summary: MatchSummary,
  ownerTeamObjectives: TeamSummary["objectives"] | undefined,
  series: GoldPoint[]
): VerdictResult {
  const latePoints = series.filter((p) => p.min >= 25);
  const aheadAt25 = latePoints.length > 0 && (latePoints[0]?.diff ?? 0) > 500;
  const barons = ownerTeamObjectives?.baron.kills ?? 0;

  if (summary.win) {
    if (aheadAt25) {
      if (barons >= 2)
        return { verdict: `Closed with ${barons} Barons — decisive.`, tone: "positive" };
      return { verdict: "Led throughout late — closed it.", tone: "positive" };
    }
    return { verdict: "Fought back in late and closed it.", tone: "positive" };
  }
  if (aheadAt25) return { verdict: "Led into late — couldn't close.", tone: "warning" };
  return { verdict: "Got closed out in late.", tone: "warning" };
}
