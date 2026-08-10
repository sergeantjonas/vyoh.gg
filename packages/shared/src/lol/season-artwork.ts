// The season-ridge artwork: the owner's match history as one continuous
// thread. Each match is a segment of the cumulative win/loss walk, colored by
// the champion it was played on; the five highest-kill games get a knot.
//
// Deterministic by contract — same matches in, same SVG string out — because
// the web recap renders it inline while the api embeds it as an OG-card
// background, and the two must agree. No clock, no randomness.
//
// Remake filtering and champion-color resolution are the caller's concern:
// project matches through excludeRemakes() and championTheme() (web) before
// building the input.

export interface SeasonArtworkMatch {
  win: boolean;
  kills: number;
  /** Resolved champion accent, e.g. championTheme(alias).dominantHex. */
  colorHex: string;
}

export interface SeasonRidgeOptions {
  width?: number;
  height?: number;
  /** Solid fill behind the artwork; omitted = transparent (hero-band use). */
  background?: string;
}

const RIDGE_WIDTH = 1200;
const RIDGE_HEIGHT = 630;
const PAD_X = 60;
const PAD_Y = 80;
const KNOT_COUNT = 5;

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FALLBACK_HEX = "#888888";

function safeHex(hex: string): string {
  return HEX_RE.test(hex) ? hex : FALLBACK_HEX;
}

export function renderSeasonRidge(
  matches: readonly SeasonArtworkMatch[],
  options: SeasonRidgeOptions = {}
): string {
  const width = options.width ?? RIDGE_WIDTH;
  const height = options.height ?? RIDGE_HEIGHT;
  const n = matches.length;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];
  if (options.background !== undefined) {
    parts.push(
      `<rect width="${width}" height="${height}" fill="${safeHex(options.background)}"/>`
    );
  }
  if (n === 0) {
    parts.push("</svg>");
    return parts.join("\n");
  }

  const walk: number[] = [];
  let acc = 0;
  for (const m of matches) {
    acc += m.win ? 1 : -1;
    walk.push(acc);
  }
  const min = Math.min(0, ...walk);
  const max = Math.max(0, ...walk);
  const x = (i: number) => PAD_X + (i / (n - 1 || 1)) * (width - 2 * PAD_X);
  const y = (v: number) =>
    PAD_Y + (1 - (v - min) / (max - min || 1)) * (height - 2 * PAD_Y);

  parts.push(
    `<line x1="${PAD_X}" y1="${y(0).toFixed(1)}" x2="${width - PAD_X}" y2="${y(0).toFixed(1)}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>`
  );

  // the mass below the walk, a faint mountain silhouette
  const walkPoints = walk
    .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  parts.push(
    `<polygon points="${x(0).toFixed(1)},${height - 20} ${walkPoints} ${x(n - 1).toFixed(1)},${height - 20}" fill="#ffffff" fill-opacity="0.025"/>`
  );

  // the thread: one segment per match, colored by that match's champion
  let prevX = x(0);
  let prevY = y(0);
  matches.forEach((m, i) => {
    const cx = x(i);
    const cy = y(walk[i] ?? 0);
    parts.push(
      `<line x1="${prevX.toFixed(1)}" y1="${prevY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${safeHex(m.colorHex)}" stroke-opacity="0.92" stroke-width="2.6" stroke-linecap="round"/>`
    );
    prevX = cx;
    prevY = cy;
  });

  // knots on the thread: the highest-kill games, earlier game wins ties
  const knotIndices = matches
    .map((m, i) => ({ i, kills: m.kills }))
    .sort((a, b) => b.kills - a.kills || a.i - b.i)
    .slice(0, KNOT_COUNT);
  for (const { i } of knotIndices) {
    const m = matches[i];
    if (!m) continue;
    const c = safeHex(m.colorHex);
    const kx = x(i).toFixed(1);
    const ky = y(walk[i] ?? 0).toFixed(1);
    parts.push(
      `<circle cx="${kx}" cy="${ky}" r="9" fill="${c}" fill-opacity="0.25"/>`,
      `<circle cx="${kx}" cy="${ky}" r="3.6" fill="${c}"/>`
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}
