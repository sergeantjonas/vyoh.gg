import { queueLabel } from "@vyoh/shared";

// Stable queue → color mapping shared between the trends donut and the match
// rows so a queue always reads the same color across the app. Anchors the
// most-common queues to specific palette slots (Solo gets amber, ARAM sky,
// etc.) and hashes everything else into the same palette so it stays stable
// across renders even as the data set changes.

const PALETTE = [
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb923c", // orange
];

const ANCHORS: Record<string, string> = {
  "Ranked Solo": "#fbbf24", // amber — the "main" queue gets the warm anchor
  "Ranked Flex": "#a78bfa", // violet
  ARAM: "#38bdf8", // sky
  "Normal Draft": "#34d399", // emerald
  Quickplay: "#34d399", // emerald (modern replacement for normal draft)
  "Normal Blind": "#34d399", // emerald
  Arena: "#f472b6", // pink
  URF: "#fb923c", // orange
  Clash: "#fb923c", // orange
};

/**
 * Takes a queueId but resolves it to a label before picking a colour, and that
 * indirection is deliberate rather than leftover. Colour is a *display*
 * concern, and the surfaces that consume it (the distribution donut, the match
 * row chip) want queues that read as one thing to look like one thing: all
 * four Swarm ids share a label, so they share a slice and must share a colour.
 * Hashing the id instead would hand them four different colours and split a
 * single legend entry into four.
 *
 * The id is still the parameter, so no caller needs the label on the wire.
 */
export function queueColor(queueId: number): string {
  const label = queueLabel(queueId);
  const anchor = ANCHORS[label];
  if (anchor) return anchor;
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length] ?? PALETTE[0] ?? "#94a3b8";
}
