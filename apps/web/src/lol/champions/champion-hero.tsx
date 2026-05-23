import { supportsViewTransitions } from "@/lib/view-transition-nav";
import {
  type ChampionOrigin,
  useActiveChampion,
} from "@/lol/champions/active-champion-context";
import { championCardStyle } from "@/lol/champions/champion-card";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useLayoutEffect, useRef } from "react";

// Mirrors MatchHero: a dedicated component so the rect-morph useLayoutEffect
// only runs after this element is in the DOM. (Inlining the same effect on
// the route component fires it before the hero JSX renders, because the
// parent runs hooks before its `if (!detail) return EmptyState` early-return.)
export function ChampionHero({
  alias,
  children,
}: {
  alias: string;
  children: ReactNode;
}) {
  const { originRectRef, setOriginRect, activePosition } = useActiveChampion();
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  // Mirror the source card's view-transition-name when VT is supported and
  // we arrived from the list (activePosition was set by the row click).
  // Deep-link arrivals fall through to the browser's default crossfade.
  const viewTransitionName =
    supportsViewTransitions() && activePosition
      ? `champion-${alias}-${activePosition}`
      : undefined;
  // Captured once on mount so StrictMode's double-invocation doesn't lose the
  // origin after the first run clears originRectRef.
  const savedOrigin = useRef<ChampionOrigin | null>(null);

  // Forward animation: morph from the list card rect to the hero's natural
  // position. RAF-delayed origin consume + getBoundingClientRect mirrors
  // match-hero's pattern so StrictMode's surviving instance is the one that
  // consumes the origin, not an earlier mount-then-cleanup pass.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (
        !o ||
        o.championAlias.toLowerCase() !== alias.toLowerCase() ||
        o.direction !== "forward"
      )
        return;
      savedOrigin.current = o;
    }
    const origin = savedOrigin.current;
    if (!origin || !heroRef.current) return;
    if (reduced) return;
    const el = heroRef.current;
    el.style.visibility = "hidden";
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      setOriginRect(null);
      el.style.visibility = "";
      const dr = el.getBoundingClientRect();
      const dx = origin.rect.left - dr.left;
      const dy = origin.rect.top - dr.top;
      const sx = origin.rect.width / dr.width;
      const sy = origin.rect.height / dr.height;
      el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      el.style.visibility = "";
    };
  }, []);

  return (
    <div
      ref={heroRef}
      data-champion-card={alias}
      style={{ ...championCardStyle(alias), viewTransitionName }}
      className="relative isolate h-52 overflow-hidden rounded-lg border"
    >
      {children}
    </div>
  );
}
