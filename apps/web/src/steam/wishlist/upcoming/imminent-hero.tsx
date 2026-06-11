import { type Variants, m, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { CountUp } from "@/components/count-up";
import {
  SHADOW_ACCENT,
  SHADOW_BODY,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
  STROKE_LABEL,
} from "@/home/recap/chapter-shadows";
import { GameRatingBadge } from "@/steam/_shared/game-rating-badge";
import { PlatformIconRow } from "@/steam/_shared/platform-icon-row";
import { useSteamGameBackdrop } from "@/steam/profile-backdrop";
import { formatWishlistReleaseLabel } from "@/steam/wishlist/format";
import type { DayRelease } from "@/steam/wishlist/upcoming/bucketing";
import { useWishlistHeroMeta } from "@/steam/wishlist/upcoming/use-wishlist-hero-meta";

// The Upcoming view's cover story (§ Art direction — "temporal certainty maps
// to visual prominence"): the nearest day-precise release rendered as a single
// subject chapter, not a card. The page backdrop is leased to the game's hero
// art for the duration; the editorial text sits on it directly, applying the
// subject-chapter spec's typography/accent/cascade vocabulary (bare wrapper,
// eyebrow → masthead → meta cascade, days-until as the lone count-up beat,
// accent via paint-order:stroke + shadow tiers).
//
// The hero is chosen + skip-gated by the panel (pickImminentRelease); this
// component assumes a valid future day-precise candidate. The enriched chrome
// (accent, platforms, ESRB, blurb) streams in from the hero-meta endpoint —
// the name + days-until come from the wishlist item, so the hero is legible the
// instant it mounts and the rest fades in.

// Cascade timing (seconds). Mirrors the subject-chapter spec's eyebrow → mast-
// head → meta ramp, scaled to this hero's three beats. The count-up fires only
// after the days-until line has settled, so it reads as a deliberate beat
// rather than competing with the reveal.
const REVEAL: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const BEAT: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const BEAT_HERO: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(14px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1, ease: "easeOut" },
  },
};
// The days-until line is the 3rd beat (eyebrow, masthead, count line); fire the
// count-up just after it reveals: delayChildren + 2×stagger + ~settle.
const COUNTUP_DELAY = 0.05 + 0.12 * 2 + 0.45;

export function ImminentHero({ release }: { release: DayRelease }) {
  const { item, daysUntil } = release;
  const { data: meta } = useWishlistHeroMeta(item.appid);

  // Lease the page backdrop to this game's hero art for as long as the hero is
  // mounted. Works before meta loads (the proxy resolves hero art by appid; the
  // assetTimestamp only sharpens cache-busting), so the cover story lands on
  // first paint and the lease releases — reverting to the Steam profile
  // backdrop — when the tab switches away or no candidate qualifies.
  useSteamGameBackdrop({
    appid: item.appid,
    assetTimestamp: meta?.assetTimestamp ?? null,
  });

  const reduced = useReducedMotion() === true;
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const active = inView || reduced;

  const accent = meta?.dominantHex ?? null;
  const name = item.name ?? "Untitled";
  const dateLabel = formatWishlistReleaseLabel(item);

  // Accent text needs a true outline to survive hue collision on the leased
  // hero art (red-on-red); fall back to the plain masthead shadow when the
  // accent hasn't resolved yet (or extraction failed) so the number is never
  // a bare unshadowed glyph over busy art.
  const accentStyle = accent
    ? {
        color: accent,
        paintOrder: "stroke" as const,
        WebkitTextStroke: STROKE_ACCENT,
        textShadow: SHADOW_ACCENT,
      }
    : { textShadow: SHADOW_MASTHEAD };

  return (
    <m.section
      ref={ref}
      aria-label={`Next release: ${name}`}
      className="relative flex flex-col gap-4 py-6 sm:py-8"
      variants={REVEAL}
      initial={reduced ? false : "hidden"}
      animate={active ? "show" : "hidden"}
    >
      <m.p
        variants={BEAT}
        className="text-xs font-semibold uppercase tracking-[0.25em] text-foreground/80"
        style={{
          textShadow: SHADOW_LABEL,
          WebkitTextStroke: STROKE_LABEL,
          paintOrder: "stroke",
        }}
      >
        Next on the wishlist
      </m.p>

      <m.h2
        variants={BEAT_HERO}
        className="text-4xl font-bold tracking-tight sm:text-5xl"
        style={{ textShadow: SHADOW_MASTHEAD }}
      >
        <a
          href={item.storeUrl}
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer transition-opacity hover:opacity-95"
        >
          {name}
        </a>
      </m.h2>

      <m.p
        variants={BEAT}
        className="text-3xl font-bold tracking-tight sm:text-4xl"
        style={{ textShadow: SHADOW_MASTHEAD }}
      >
        <Countdown daysUntil={daysUntil} active={active} accentStyle={accentStyle} />
      </m.p>

      <m.div
        variants={BEAT}
        className="flex flex-wrap items-center gap-3 text-sm text-foreground/80"
        style={{ textShadow: SHADOW_BODY }}
      >
        {dateLabel ? <span>{dateLabel}</span> : null}
        <PlatformIconRow
          windows={meta?.platformWindows ?? null}
          mac={meta?.platformMac ?? null}
          linux={meta?.platformLinux ?? null}
          vr={null}
        />
        <GameRatingBadge rating={meta?.gameRating ?? null} />
      </m.div>

      {meta?.shortDescription ? (
        <m.p
          variants={BEAT}
          className="max-w-prose text-sm leading-relaxed text-foreground/75"
          style={{ textShadow: SHADOW_BODY }}
        >
          {meta.shortDescription}
        </m.p>
      ) : null}
    </m.section>
  );
}

// The lone count-up beat. Tomorrow/today collapse to a word — counting up to 1
// or 0 reads as a glitch, and "tomorrow" carries the urgency better than a
// number. The accent tint lands on the number itself (the temporal-certainty
// focal), with the framing words in the inherited masthead colour.
function Countdown({
  daysUntil,
  active,
  accentStyle,
}: {
  daysUntil: number;
  active: boolean;
  accentStyle: React.CSSProperties;
}) {
  if (daysUntil <= 0) return <span style={accentStyle}>Out today</span>;
  if (daysUntil === 1) return <span style={accentStyle}>Out tomorrow</span>;
  return (
    <span>
      in{" "}
      <span style={accentStyle}>
        <CountUp to={daysUntil} start={active} delay={COUNTUP_DELAY} duration={0.9} />
      </span>{" "}
      days
    </span>
  );
}
