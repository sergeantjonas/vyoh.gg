import { readFileSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(__dirname, "assets");

// The orb mark SVG is a thin `<svg>` wrapper around an embedded base64 PNG
// (the asset is a raster glyph with 3D shading, not a vector path). Satori's
// `<img>` accepts data URLs directly, so we extract the inner PNG payload
// once at module load and hand the raw `data:image/png;base64,…` string to
// the home OG template — Satori → resvg rasterizes it natively without
// re-parsing the SVG container.
//
// Keep this in sync with `apps/web/public/vyoh-orb-mark.svg`. If the source
// changes, re-copy and the extracted data URL updates automatically. We
// don't store a derived `.png` because that would duplicate state — the SVG
// container in `og/assets/` is the same file checked in for the web's
// favicon/landing usage; one source.

function extractOrbDataUrl(): string {
  const svg = readFileSync(join(assetsDir, "orb-mark.svg"), "utf8");
  // The SVG body is `<image href="data:image/png;base64,…"/>`. Grab the
  // attribute value verbatim — `href` is unique in this file so a single
  // exec is safe. If extraction fails we throw at startup so the home OG
  // endpoint never serves a card with a missing image hole.
  const match = svg.match(/href="(data:image\/png;base64,[^"]+)"/);
  if (!match?.[1]) {
    throw new Error(
      "orb-mark.svg shape unexpected — could not find embedded PNG data URL"
    );
  }
  return match[1];
}

export const ORB_MARK_DATA_URL = extractOrbDataUrl();
