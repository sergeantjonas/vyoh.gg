import { describe, expect, it } from "vitest";
import { type SeasonArtworkMatch, renderSeasonRidge } from "./season-artwork.ts";

function season(): SeasonArtworkMatch[] {
  const colors = ["#f04444", "#3b82f6", "#22c55e", "#e879f9"];
  return Array.from({ length: 40 }, (_, i) => ({
    win: [true, true, false, true, false][i % 5] ?? false,
    kills: (i * 7) % 13,
    colorHex: colors[i % colors.length] ?? "#f04444",
  }));
}

describe("renderSeasonRidge", () => {
  it("is deterministic — same input, same output", () => {
    expect(renderSeasonRidge(season())).toBe(renderSeasonRidge(season()));
  });

  it("draws one thread segment per match plus the baseline", () => {
    const svg = renderSeasonRidge(season());
    expect(svg.match(/<line /g)).toHaveLength(41);
  });

  it("marks the five highest-kill games with two-circle knots", () => {
    const svg = renderSeasonRidge(season());
    expect(svg.match(/<circle /g)).toHaveLength(10);
  });

  it("marks every match when there are fewer than five", () => {
    const svg = renderSeasonRidge(season().slice(0, 3));
    expect(svg.match(/<circle /g)).toHaveLength(6);
  });

  it("uses each match's champion color on its segment", () => {
    const svg = renderSeasonRidge(season());
    for (const hex of ["#f04444", "#3b82f6", "#22c55e", "#e879f9"]) {
      expect(svg).toContain(`stroke="${hex}"`);
    }
  });

  it("replaces a malformed color instead of emitting it into markup", () => {
    const svg = renderSeasonRidge([{ win: true, kills: 3, colorHex: '"/><script>' }]);
    expect(svg).not.toContain("script");
    expect(svg).toContain('stroke="#888888"');
  });

  it("is transparent by default and solid when a background is passed", () => {
    expect(renderSeasonRidge(season())).not.toContain("<rect");
    expect(renderSeasonRidge(season(), { background: "#0a0c10" })).toContain(
      '<rect width="1200" height="630" fill="#0a0c10"/>'
    );
  });

  it("honours explicit dimensions", () => {
    const svg = renderSeasonRidge(season(), { width: 1600, height: 420 });
    expect(svg).toContain('width="1600" height="420" viewBox="0 0 1600 420"');
  });

  it("renders an empty season and a single match without NaN coordinates", () => {
    expect(renderSeasonRidge([])).toContain("</svg>");
    const single = renderSeasonRidge([{ win: false, kills: 0, colorHex: "#f04444" }]);
    expect(single).not.toContain("NaN");
    expect(renderSeasonRidge([])).not.toContain("NaN");
  });

  it("renders an all-win season without NaN (degenerate walk range)", () => {
    const svg = renderSeasonRidge(
      Array.from({ length: 5 }, () => ({
        win: true,
        kills: 1,
        colorHex: "#f04444",
      }))
    );
    expect(svg).not.toContain("NaN");
  });
});
