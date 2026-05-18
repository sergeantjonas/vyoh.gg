import { truncatePatch } from "@/lol/_shared/patch/patch-version";
import type { MatchSummary, ParsedMatchQuery } from "@vyoh/shared";

function kda(match: MatchSummary): number {
  return (match.kills + match.assists) / Math.max(1, match.deaths);
}

export function matchesQuery(match: MatchSummary, parsed: ParsedMatchQuery): boolean {
  const champion = match.champion.toLowerCase();
  const queue = match.queueType.toLowerCase();
  const role = match.teamPosition.toLowerCase();
  const patch = truncatePatch(match.gameVersion);
  const opponent = match.laneOpponent?.championName.toLowerCase() ?? "";
  const playedAt = new Date(match.playedAt).getTime();

  if (parsed.outcome === "win" && !match.win) return false;
  if (parsed.outcome === "loss" && match.win) return false;

  for (const w of parsed.withChampions) {
    if (!champion.includes(w)) return false;
  }
  for (const v of parsed.vsChampions) {
    if (!opponent.includes(v)) return false;
  }
  for (const q of parsed.queues) {
    if (!queue.includes(q)) return false;
  }
  for (const r of parsed.roles) {
    if (!role.includes(r)) return false;
  }
  if (parsed.patches.length > 0 && !parsed.patches.includes(patch)) return false;

  if (parsed.since && playedAt < parsed.since.getTime()) return false;
  if (parsed.until && playedAt >= parsed.until.getTime()) return false;

  if (parsed.kdaGt !== null && !(kda(match) > parsed.kdaGt)) return false;
  if (parsed.kdaLt !== null && !(kda(match) < parsed.kdaLt)) return false;

  if (parsed.freeText) {
    const hay = `${champion} ${queue} ${role} ${opponent} ${match.matchId.toLowerCase()}`;
    if (!hay.includes(parsed.freeText)) return false;
  }

  // duo: is parsed for future wiring once duo data is plumbed into the palette;
  // matcher currently no-ops it. See command-palette.md C2/D2.

  return true;
}
