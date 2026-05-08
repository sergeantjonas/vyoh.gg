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

export function queueColor(queueType: string): string {
  const anchor = ANCHORS[queueType];
  if (anchor) return anchor;
  let h = 2166136261;
  for (let i = 0; i < queueType.length; i++) {
    h = Math.imul(h ^ queueType.charCodeAt(i), 16777619) >>> 0;
  }
  return PALETTE[h % PALETTE.length] ?? PALETTE[0] ?? "#94a3b8";
}
