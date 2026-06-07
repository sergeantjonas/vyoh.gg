import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { fonts } from "./og-fonts";

// Every OG card renders at the canonical OG aspect (1200×630). One constant so
// future surface additions don't drift, and the Satori `width`/`height` opts
// stay in lockstep with the `<div>` root that Satori measures against.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Card data shapes — one per template. Each generator returns a Buffer of the
// finished PNG; the upstream OgService composes the data, the card knows only
// how to lay it out.

export interface MatchCardData {
  championName: string;
  // Upstream image URLs to try in order, first 2xx wins. Mirrors the shape
  // returned by `LolImageService.champion(alias, variant)` so the OG card
  // consumes the same wiki-primary + CDragon-fallback chain every other
  // surface uses — single source of truth for asset resolution.
  splashUrls: string[];
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  queueType: string;
  durationLabel: string;
  accountLabel: string;
  region: string;
}

export interface ChampionCardData {
  championName: string;
  // Same shape as Match's `splashUrls` — caller threads through whatever the
  // resolver hands back, the card stays oblivious to wiki vs CDragon.
  splashUrls: string[];
  // Sub-label under the champion name. Composed by the caller (typically
  // "Marksman" or "Fighter · Tank"); the card just renders the string.
  subLabel: string;
}

export interface ProfileCardData {
  // gameName#tagLine — per [og-image-pipeline.md decision #4], never the slug.
  accountLabel: string;
  // Headline rank line (e.g. "Platinum III · 47 LP"); null when unranked,
  // which the card renders as "Unranked" instead of dropping the row.
  rankLine: string | null;
  // KPI tiles — typically three (WR / KDA / TOTAL). The card lays them out as
  // an evenly-spaced strip; the caller picks the columns so the OG can flex
  // when stats are missing (e.g. fresh accounts).
  kpis: Array<{ label: string; value: string }>;
  region: string;
}

export interface HomeCardData {
  // Just a tagline string — owner-curated, lives at the call site. The
  // wordmark + OrbMark glyph are hard-coded into the card layout.
  tagline: string;
}

export interface SteamGameCardData {
  gameName: string;
  // Same shape as the LoL cards; carries the Steam image-resolver's
  // hero-large URL chain (hashed → SGDB → legacy fallback).
  heroUrls: string[];
  // Optional one-line marketing blurb from the enrichment row; the card
  // hides the row entirely when null.
  shortDescription: string | null;
  // Three KPI tiles — playtime, completion %, last played. Caller composes
  // the strings (the card doesn't format minutes-to-hours etc.).
  kpis: Array<{ label: string; value: string }>;
}

// -----------------------------------------------------------------------------
// Shared rendering helpers
// -----------------------------------------------------------------------------

async function fetchAsDataUrl(urls: readonly string[]): Promise<string> {
  // Try the resolver-supplied URLs in order; the first 2xx wins. Mirrors the
  // proxy controller's `proxyWebp` fallback semantics (see img.controller.ts)
  // so wiki blips fall through to CDragon/DDragon cleanly. We deliberately do
  // NOT honour the proxy's WebP transcoding — Satori's image embedding needs
  // PNG/JPEG, and feeding raw upstream bytes (always PNG/JPEG at this layer)
  // avoids the WebP round-trip entirely. Throws when every URL misses so the
  // controller can return 404 instead of a card with a broken image hole.
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`fetch ${url} → HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("no OG splash URL produced a response");
}

type Element = { type: string; props: Record<string, unknown> };

function e(
  type: string,
  props: Record<string, unknown>,
  ...children: Array<Element | string | number>
): Element {
  if (children.length === 0) return { type, props };
  if (children.length === 1) {
    return { type, props: { ...props, children: children[0] } };
  }
  return { type, props: { ...props, children } };
}

// `vyoh.gg` wordmark — shared across every card so the brand mark stays
// consistent in size, weight, and color. Positioned by the caller's wrapper.
function wordmark(): Element {
  return e(
    "div",
    {
      style: {
        display: "flex",
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "0.02em",
      },
    },
    e("span", { style: { color: "#a78bfa" } }, "vyoh"),
    e("span", { style: { color: "#a1a1aa" } }, ".gg")
  );
}

async function svgToPng(card: Element): Promise<Buffer> {
  const svg = await satori(card as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });
  return new Resvg(svg).render().asPng();
}

// -----------------------------------------------------------------------------
// Match card — split layout: left splash + right stat panel. The first card
// surface shipped; retrofitted to consume `splashUrls` from the resolver so
// every LoL card shares one asset-resolution code path.
// -----------------------------------------------------------------------------

export async function renderMatchCard(data: MatchCardData): Promise<Buffer> {
  const splashDataUrl = await fetchAsDataUrl(data.splashUrls);
  const accent = data.win ? "#34d399" : "#f87171";

  const card = e(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: "#0a0a0a",
        color: "#f4f4f5",
        fontFamily: "Geist",
      },
    },
    e("img", {
      src: splashDataUrl,
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 740,
        height: OG_HEIGHT,
        objectFit: "cover",
        objectPosition: "center top",
        filter: "saturate(0.9)",
      },
    }),
    e("div", {
      style: {
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width: 740,
        height: OG_HEIGHT,
        backgroundImage:
          "linear-gradient(to right, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.4) 60%, rgba(10,10,10,1) 100%)",
      },
    }),
    e("div", {
      style: {
        display: "flex",
        position: "absolute",
        left: 0,
        bottom: 0,
        width: OG_WIDTH,
        height: 4,
        backgroundColor: accent,
        opacity: 0.55,
      },
    }),
    e(
      "div",
      {
        style: {
          position: "absolute",
          right: 0,
          top: 0,
          width: 540,
          height: OG_HEIGHT,
          display: "flex",
          flexDirection: "column",
          padding: "88px 64px",
          boxSizing: "border-box",
          justifyContent: "space-between",
        },
      },
      wordmark(),
      e(
        "div",
        {
          style: { display: "flex", flexDirection: "column", gap: 18 },
        },
        e(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 60,
              fontWeight: 600,
              lineHeight: 1.05,
              color: "#f4f4f5",
            },
          },
          data.championName
        ),
        e(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 72,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              alignItems: "center",
            },
          },
          e("span", { style: { color: "#34d399" } }, String(data.kills)),
          e("span", { style: { color: "#52525b", padding: "0 14px" } }, "/"),
          e("span", { style: { color: "#f87171" } }, String(data.deaths)),
          e("span", { style: { color: "#52525b", padding: "0 14px" } }, "/"),
          e("span", { style: { color: "#fbbf24" } }, String(data.assists))
        ),
        e(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 16,
            },
          },
          e(
            "div",
            {
              style: {
                display: "flex",
                fontSize: 22,
                fontWeight: 600,
                color: accent,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              },
            },
            data.win ? "Win" : "Loss"
          ),
          e(
            "div",
            {
              style: {
                display: "flex",
                fontSize: 22,
                color: "#71717a",
              },
            },
            `· ${data.queueType} · ${data.durationLabel}`
          )
        )
      ),
      e(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 22,
            color: "#a1a1aa",
            letterSpacing: "0.02em",
          },
        },
        data.accountLabel,
        e("span", { style: { color: "#52525b", padding: "0 10px" } }, "·"),
        e("span", { style: { color: "#71717a" } }, data.region)
      )
    )
  );

  return svgToPng(card);
}

// -----------------------------------------------------------------------------
// Champion card — full-bleed splash backdrop + editorial headline. Composes
// the wordmark in the top-right; champion name + sub-label (role/class) sit
// bottom-left over the dimmed splash.
// -----------------------------------------------------------------------------

export async function renderChampionCard(data: ChampionCardData): Promise<Buffer> {
  const splashDataUrl = await fetchAsDataUrl(data.splashUrls);

  const card = e(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: "#0a0a0a",
        color: "#f4f4f5",
        fontFamily: "Geist",
      },
    },
    // Full-bleed splash. `centered` framing already isolates the subject; we
    // cover-fit it to OG dims and dim slightly so the headline reads.
    e("img", {
      src: splashDataUrl,
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_WIDTH,
        height: OG_HEIGHT,
        objectFit: "cover",
        objectPosition: "center top",
        filter: "saturate(0.95)",
      },
    }),
    // Vertical bottom-darken gradient — keeps the bottom-anchored headline
    // legible without flattening the splash's depth. Sharper than the match
    // card's horizontal gradient because the headline lives below, not right.
    e("div", {
      style: {
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundImage:
          "linear-gradient(to bottom, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0) 35%, rgba(10,10,10,0.65) 75%, rgba(10,10,10,0.95) 100%)",
      },
    }),
    // Wordmark anchored top-right; same treatment as match card.
    e(
      "div",
      {
        style: {
          position: "absolute",
          top: 48,
          right: 64,
          display: "flex",
        },
      },
      wordmark()
    ),
    // Bottom-anchored headline. Two-line block: champion name (display),
    // sub-label (role/class). Padding mirrors the match card's right panel
    // (88px 64px) so the editorial corner alignment is consistent.
    e(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          bottom: 72,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        },
      },
      e(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 96,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "#f4f4f5",
          },
        },
        data.championName
      ),
      e(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 26,
            color: "#d4d4d8",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          },
        },
        data.subLabel
      )
    )
  );

  return svgToPng(card);
}

// -----------------------------------------------------------------------------
// Profile card — typographic, no full-bleed splash. Account headline + rank
// line up top, KPI strip across the middle, wordmark + region down low.
// -----------------------------------------------------------------------------

export async function renderProfileCard(data: ProfileCardData): Promise<Buffer> {
  const card = e(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        // Slight warm gradient backdrop so the all-typography card has some
        // body; oklch math happens client-side here (Satori doesn't compute
        // color-mix), so we hand-tune the stops.
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(10,10,10,1) 50%, rgba(245,158,11,0.06) 100%)",
        color: "#f4f4f5",
        fontFamily: "Geist",
        padding: "96px 80px",
        boxSizing: "border-box",
        justifyContent: "space-between",
      },
    },
    // Top block: account name + rank line.
    e(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 20 } },
      wordmark(),
      e(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 88,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#f4f4f5",
          },
        },
        data.accountLabel
      ),
      e(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 30,
            color: data.rankLine ? "#a78bfa" : "#71717a",
            letterSpacing: "0.04em",
          },
        },
        data.rankLine ?? "Unranked"
      )
    ),
    // KPI strip — evenly distributed across the bottom band. Each tile is a
    // (value, label) pair; value sits on the editorial scale used elsewhere
    // (KDA / win-rate / lifetime tiles).
    e(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          gap: 64,
          alignItems: "flex-end",
          justifyContent: "space-between",
        },
      },
      ...data.kpis.map((kpi) =>
        e(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 4,
            },
          },
          e(
            "div",
            {
              style: {
                display: "flex",
                fontSize: 60,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: "#f4f4f5",
                lineHeight: 1,
              },
            },
            kpi.value
          ),
          e(
            "div",
            {
              style: {
                display: "flex",
                fontSize: 18,
                color: "#a1a1aa",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              },
            },
            kpi.label
          )
        )
      ),
      e(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 18,
            color: "#71717a",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          },
        },
        data.region
      )
    )
  );

  return svgToPng(card);
}

// -----------------------------------------------------------------------------
// Home card — static-content surface, but rendered dynamically per request
// (per [og-image-pipeline.md decision #2]) so every endpoint shares one shape.
// Centered editorial composition: wordmark, large OrbMark glyph, tagline.
// -----------------------------------------------------------------------------

export async function renderHomeCard(data: HomeCardData): Promise<Buffer> {
  const card = e(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: "#0a0a0a",
        // Same warm-cool gradient signature as the profile card; ties the
        // home OG to the site's editorial palette.
        backgroundImage:
          "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(10,10,10,1) 50%, rgba(245,158,11,0.08) 100%)",
        color: "#f4f4f5",
        fontFamily: "Geist",
        gap: 48,
      },
    },
    // OrbMark glyph — large concentric-circle composition rendered with three
    // stacked divs (Satori has no SVG primitive). Layered halos mimic the
    // orb's atmospheric character without pulling in an actual SVG asset.
    e(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 240,
          height: 240,
          position: "relative",
        },
      },
      e("div", {
        style: {
          position: "absolute",
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: "rgba(124,58,237,0.18)",
        },
      }),
      e("div", {
        style: {
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: "rgba(167,139,250,0.35)",
        },
      }),
      e("div", {
        style: {
          position: "absolute",
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: "#c4b5fd",
        },
      })
    ),
    // Wordmark at home-OG scale (much larger than the corner mark used in
    // other cards) — it's the focal lockup, not a corner accent.
    e(
      "div",
      {
        style: {
          display: "flex",
          fontSize: 96,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        },
      },
      e("span", { style: { color: "#a78bfa" } }, "vyoh"),
      e("span", { style: { color: "#a1a1aa" } }, ".gg")
    ),
    e(
      "div",
      {
        style: {
          display: "flex",
          fontSize: 28,
          color: "#a1a1aa",
          letterSpacing: "0.04em",
        },
      },
      data.tagline
    )
  );

  return svgToPng(card);
}

// -----------------------------------------------------------------------------
// Steam game card — same architecture as the match card (left art + right
// content panel) but the left art is the Steam library hero (16:9-shaped) and
// the right panel surfaces game name + blurb + KPIs.
// -----------------------------------------------------------------------------

export async function renderSteamGameCard(data: SteamGameCardData): Promise<Buffer> {
  const heroDataUrl = await fetchAsDataUrl(data.heroUrls);

  const card = e(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: "#0a0a0a",
        color: "#f4f4f5",
        fontFamily: "Geist",
      },
    },
    e("img", {
      src: heroDataUrl,
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 740,
        height: OG_HEIGHT,
        objectFit: "cover",
        objectPosition: "center center",
        filter: "saturate(0.95)",
      },
    }),
    e("div", {
      style: {
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width: 740,
        height: OG_HEIGHT,
        backgroundImage:
          "linear-gradient(to right, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.4) 60%, rgba(10,10,10,1) 100%)",
      },
    }),
    // Steam blue bottom accent — mirrors the LoL match card's win/loss
    // accent strip but in Steam's brand teal so the surface telegraphs the
    // source platform at a glance.
    e("div", {
      style: {
        display: "flex",
        position: "absolute",
        left: 0,
        bottom: 0,
        width: OG_WIDTH,
        height: 4,
        backgroundColor: "#66c0f4",
        opacity: 0.5,
      },
    }),
    e(
      "div",
      {
        style: {
          position: "absolute",
          right: 0,
          top: 0,
          width: 540,
          height: OG_HEIGHT,
          display: "flex",
          flexDirection: "column",
          padding: "88px 64px",
          boxSizing: "border-box",
          justifyContent: "space-between",
        },
      },
      wordmark(),
      e(
        "div",
        {
          style: { display: "flex", flexDirection: "column", gap: 24 },
        },
        e(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 52,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#f4f4f5",
            },
          },
          data.gameName
        ),
        // Marketing blurb — hidden when null. The card stays composable so
        // titles without enrichment data still render cleanly (KPIs do the
        // lifting in that case).
        data.shortDescription
          ? e(
              "div",
              {
                style: {
                  display: "flex",
                  fontSize: 22,
                  color: "#a1a1aa",
                  lineHeight: 1.4,
                  // Truncate long blurbs at ~3 visual lines; the right panel is
                  // 540×~250 in this block. Satori doesn't support line-clamp,
                  // so callers should pre-truncate; we set a max-height so a
                  // stray long blurb never pushes the KPI strip off-canvas.
                  maxHeight: 130,
                  overflow: "hidden",
                },
              },
              data.shortDescription
            )
          : e("div", { style: { display: "flex", height: 0 } })
      ),
      e(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            gap: 32,
            alignItems: "flex-end",
          },
        },
        ...data.kpis.map((kpi) =>
          e(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 4,
              },
            },
            e(
              "div",
              {
                style: {
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: "#f4f4f5",
                  lineHeight: 1,
                },
              },
              kpi.value
            ),
            e(
              "div",
              {
                style: {
                  display: "flex",
                  fontSize: 15,
                  color: "#a1a1aa",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                },
              },
              kpi.label
            )
          )
        )
      )
    )
  );

  return svgToPng(card);
}
