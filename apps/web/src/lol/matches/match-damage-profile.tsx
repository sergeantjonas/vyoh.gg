import type { ParticipantDetail } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.28 },
} as const;

function fmtK(n: number) {
  return `${(n / 1000).toFixed(1)}k`;
}

export function MatchDamageProfile({
  detail,
  myPuuid,
}: {
  detail: { participants: ParticipantDetail[] };
  myPuuid?: string | undefined;
}) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const me = myPuuid ? detail.participants.find((p) => p.puuid === myPuuid) : undefined;
  if (!me?.owner) return null;

  const physical = me.damageDealtPhysical;
  const magic = me.damageDealtMagic;
  const trueDmg = me.damageDealtTrue;
  const dealt = physical + magic + trueDmg;
  const { totalDamageTaken: taken, damageSelfMitigated: mitigated } = me.owner.survival;
  const max = Math.max(dealt, taken, mitigated, 1);

  const pct = (v: number) => (max > 0 ? (v / max) * 100 : 0);
  const physW = pct(physical);
  const magicW = pct(magic);
  const trueW = pct(trueDmg);
  const takenW = pct(taken);
  const mitigatedW = pct(mitigated);

  const dominant =
    physical >= magic && physical >= trueDmg
      ? { label: "phys", share: dealt > 0 ? Math.round((physical / dealt) * 100) : 0 }
      : magic >= trueDmg
        ? { label: "magic", share: dealt > 0 ? Math.round((magic / dealt) * 100) : 0 }
        : { label: "true", share: dealt > 0 ? Math.round((trueDmg / dealt) * 100) : 0 };

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium">Damage profile</h3>
      <div className="flex flex-col gap-4 rounded-md border bg-card/60 p-4 backdrop-blur-sm">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Dealt</span>
            <div className="flex items-center gap-1 font-mono text-xs tabular-nums">
              <span>{fmtK(dealt)}</span>
              <span className="text-muted-foreground">
                ({dominant.share}% {dominant.label})
              </span>
            </div>
          </div>
          <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-orange-500/90 to-red-400/90"
              style={{ transformOrigin: "left", width: `${physW}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.18 }
              }
            />
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-blue-500/90 to-violet-400/90"
              style={{ transformOrigin: "left", width: `${magicW}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.22 }
              }
            />
            {trueW > 0 && (
              <m.div
                className="h-full shrink-0 bg-white/55"
                style={{ transformOrigin: "left", width: `${trueW}%` }}
                animate={{ scaleX: playing || reduced ? 1 : 0 }}
                transition={
                  !playing || reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 220, damping: 28, delay: 0.26 }
                }
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Taken</span>
            <span className="font-mono text-xs tabular-nums">{fmtK(taken)}</span>
          </div>
          <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-amber-500/80 to-orange-400/80"
              style={{ transformOrigin: "left", width: `${takenW}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.3 }
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Mitigated</span>
            <span className="font-mono text-xs tabular-nums">{fmtK(mitigated)}</span>
          </div>
          <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-emerald-500/80 to-teal-400/80"
              style={{ transformOrigin: "left", width: `${mitigatedW}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.34 }
              }
            />
          </div>
        </div>
      </div>
    </m.section>
  );
}
