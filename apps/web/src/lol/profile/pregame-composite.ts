import type { RitualSignal } from "@/lol/profile/ritual-tile";

export interface CompositeRead {
  band: string;
  confidence: string;
  tone: RitualSignal["tone"];
  empty: boolean;
  firing: number;
}

export function toneToScore(tone: RitualSignal["tone"]): number {
  if (tone === "positive") return 1;
  if (tone === "warning") return -1;
  return 0;
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatBand(center: number, halfWidth: number): string {
  const low = center - halfWidth;
  const high = center + halfWidth;
  return `${formatSigned(low)} to ${formatSigned(high)} LP`;
}

export function buildComposite(signals: RitualSignal[]): CompositeRead {
  const scores = signals.map((s) => toneToScore(s.tone));
  const firing = scores.filter((s) => s !== 0).length;

  if (firing === 0) {
    return {
      band: "Play a few games and we'll have a read.",
      confidence: "",
      tone: "neutral",
      empty: true,
      firing: 0,
    };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  // 0.3 → +5..+15, -0.5 → -15..-5, etc. Center scales with score; band stays ±5.
  const center = Math.round(mean * 20);
  const band = formatBand(center, 5);

  // Confidence reflects how many signals had a non-neutral read.
  // Phase LP1 is intentionally naive — we don't yet weight by sample-size
  // inside each signal, only by how many signals fired at all.
  let confidence: string;
  if (firing >= 3) confidence = "";
  else if (firing === 2) confidence = "directional only";
  else confidence = "low confidence — small sample";

  let tone: RitualSignal["tone"] = "neutral";
  if (mean >= 0.25) tone = "positive";
  else if (mean <= -0.25) tone = "warning";

  return { band, confidence, tone, empty: false, firing };
}
