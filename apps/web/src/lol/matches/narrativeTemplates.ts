import { formatPercent } from "@vyoh/shared";

export type NarrativeTone = "positive" | "neutral" | "warning";

export type NarrativeSentence = {
  text: string;
  tone: NarrativeTone;
};

function fmtSec(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

// --- Individual sentence generators ---
// Each returns null when there is no notable signal worth surfacing.

export function getTimeDeadSentence(
  thisGameSec: number,
  baselineSec: number | undefined
): NarrativeSentence | null {
  if (!baselineSec) return null;
  const rel = (thisGameSec - baselineSec) / baselineSec;
  const fmt = fmtSec(Math.round(thisGameSec));
  const pct = formatPercent(Math.abs(rel));

  if (rel < -0.2) {
    return {
      text: `You spent ${fmt} dead — ${pct} below your baseline. Clean on survival.`,
      tone: "positive",
    };
  }
  if (rel > 0.2) {
    return {
      text: `You spent ${fmt} dead — ${pct} above your baseline. Deaths were costly.`,
      tone: "warning",
    };
  }
  return { text: `You spent ${fmt} dead — near your baseline.`, tone: "neutral" };
}

export function getSpellActivitySentence(
  spellCasts: { q: number; w: number; e: number; r: number },
  durationSec: number
): NarrativeSentence | null {
  if (durationSec <= 0) return null;
  const durationMin = durationSec / 60;
  const totalPerMin =
    (spellCasts.q + spellCasts.w + spellCasts.e + spellCasts.r) / durationMin;
  const rPerMin = spellCasts.r / durationMin;

  // Low ult usage is the most actionable signal; surface it first for longer games.
  if (durationMin >= 20 && rPerMin < 0.5) {
    const plural = spellCasts.r === 1 ? "time" : "times";
    return {
      text: `R used ${spellCasts.r} ${plural} — ult may be underused at ${rPerMin.toFixed(1)}× per minute.`,
      tone: "warning",
    };
  }

  if (totalPerMin < 5) {
    return {
      text: `${totalPerMin.toFixed(1)} ability casts per minute — passive game.`,
      tone: "warning",
    };
  }
  if (totalPerMin >= 12) {
    return {
      text: `${totalPerMin.toFixed(1)} ability casts per minute — high activity.`,
      tone: "positive",
    };
  }
  return { text: `${totalPerMin.toFixed(1)} ability casts per minute.`, tone: "neutral" };
}

export function getDeathTimingSentence(
  deathTimings: number[],
  durationSec: number
): NarrativeSentence | null {
  if (deathTimings.length === 0) {
    return { text: "No deaths this game.", tone: "positive" };
  }
  if (deathTimings.length < 2) return null;

  const total = deathTimings.length;
  const earlyDeaths = deathTimings.filter((t) => t < 840).length; // 0–14 min
  const lateDeaths = deathTimings.filter((t) => t >= 1500).length; // 25+ min

  if (earlyDeaths >= Math.ceil(total * 0.6)) {
    return {
      text: `${earlyDeaths} of ${total} deaths came before 14 minutes — early pressure drove the game.`,
      tone: "warning",
    };
  }
  if (lateDeaths >= Math.ceil(total * 0.6) && durationSec >= 1500) {
    return {
      text: `${lateDeaths} of ${total} deaths came after 25 minutes — late-game decisions under pressure.`,
      tone: "neutral",
    };
  }
  return null;
}

export function getCCSentence(
  timeCCingOthers: number | undefined
): NarrativeSentence | null {
  if (!timeCCingOthers || timeCCingOthers < 30) return null;
  const s = Math.round(timeCCingOthers);
  if (s >= 120) {
    return { text: `${s}s of crowd control applied — strong CC game.`, tone: "positive" };
  }
  return { text: `${s}s of crowd control applied.`, tone: "neutral" };
}

// --- Aggregator ---

export function buildNarrativeSentences(params: {
  totalTimeSpentDead: number;
  baselineTimeDead: number | undefined;
  spellCasts: { q: number; w: number; e: number; r: number };
  durationSec: number;
  deathTimings: number[];
  timeCCingOthers: number | undefined;
}): NarrativeSentence[] {
  const sentences: (NarrativeSentence | null)[] = [
    getTimeDeadSentence(params.totalTimeSpentDead, params.baselineTimeDead),
    getSpellActivitySentence(params.spellCasts, params.durationSec),
    getDeathTimingSentence(params.deathTimings, params.durationSec),
    getCCSentence(params.timeCCingOthers),
  ];
  return sentences.filter((s): s is NarrativeSentence => s !== null);
}
