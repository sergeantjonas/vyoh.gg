import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { fonts } from "./og-fonts";

export interface MatchCardData {
  championName: string;
  championAlias: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  queueType: string;
  durationLabel: string;
  accountLabel: string;
  region: string;
}

const SPLASH_URL = (alias: string) =>
  `https://cdn.communitydragon.org/latest/champion/${alias.toLowerCase()}/splash-art/centered`;

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

type Element = { type: string; props: Record<string, unknown> };

function e(
  type: string,
  props: Record<string, unknown>,
  ...children: Array<Element | string | number>
): Element {
  return {
    type,
    props: { ...props, children: children.length === 1 ? children[0] : children },
  };
}

export async function renderMatchCard(data: MatchCardData): Promise<Buffer> {
  const splashDataUrl = await fetchAsDataUrl(SPLASH_URL(data.championAlias));
  const accent = data.win ? "#34d399" : "#f87171";

  const card = e(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: 1200,
        height: 630,
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
        height: 630,
        objectFit: "cover",
        objectPosition: "center top",
        filter: "saturate(0.9)",
      },
    }),
    e("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: 740,
        height: 630,
        backgroundImage:
          "linear-gradient(to right, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.4) 60%, rgba(10,10,10,1) 100%)",
      },
    }),
    e("div", {
      style: {
        position: "absolute",
        left: 0,
        bottom: 0,
        width: 1200,
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
          height: 630,
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          boxSizing: "border-box",
          justifyContent: "space-between",
        },
      },
      e(
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
      ),
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

  const svg = await satori(card as never, {
    width: 1200,
    height: 630,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  return new Resvg(svg).render().asPng();
}
