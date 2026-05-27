import { useGameUnlockTimeline } from "@/steam/game/use-game-unlock-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// Inter-unlock gap that closes a session. 4h matches typical play-session
// length — long enough that a quick AFK doesn't split a run, short enough
// that "I came back the next evening" reads as a new session.
const SESSION_GAP_MS = 4 * 60 * 60 * 1000;

const STRIP_H = 64;
const PAD_TOP = 14; // leaves room for the "100%" goal-line label above the dashed rail
const PAD_BOTTOM = 6;
const PAD_X = 4; // viewBox units; matches the dot-cap padding so peaks don't kiss the edge
const DOT_R = 3;
const TIME_ZONE = "Europe/Brussels";

type Session = {
  start: Date;
  end: Date;
  count: number;
};

function detectSessions(unlocks: Date[]): Session[] {
  const sessions: Session[] = [];
  for (const t of unlocks) {
    const last = sessions[sessions.length - 1];
    if (last && t.getTime() - last.end.getTime() <= SESSION_GAP_MS) {
      last.end = t;
      last.count += 1;
    } else {
      sessions.push({ start: t, end: t, count: 1 });
    }
  }
  return sessions;
}

const DATE_FMT_FULL = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const DATE_FMT_BOOKEND = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: TIME_ZONE,
});

function sessionDate(s: Session): string {
  return DATE_FMT_FULL.format(s.start);
}

function sessionDuration(s: Session): string | null {
  const ms = s.end.getTime() - s.start.getTime();
  if (ms < 60_000) return null;
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (min === 0) return `${hours}h`;
  return `${hours}h ${min}m`;
}

type SparkPoint = { x: number; y: number; s: Session; i: number; cumulative: number };

// Plots cumulative progress toward `ceiling` (= achievementCount when known,
// else total). A synthetic start point at (PAD_X, baseline) anchors session
// 0's contribution as a visible slope rather than a free-floating start y —
// otherwise the first session has no rise-over-run to read.
function buildSparkline(
  sessions: Session[],
  ceiling: number
): {
  points: SparkPoint[];
  linePath: string;
  areaPath: string;
} {
  const baselineY = STRIP_H - PAD_BOTTOM;
  const topY = PAD_TOP;
  const usableH = baselineY - topY;
  const N = sessions.length;
  const safeCeiling = Math.max(ceiling, 1);

  // Sessions occupy columns 1..N out of N+1 slots; column 0 is the synthetic
  // baseline anchor. Equal column widths keep slope = session intensity.
  const xFor = (i: number): number => PAD_X + ((i + 1) / N) * (100 - 2 * PAD_X);
  const yFor = (cumulative: number): number =>
    baselineY - (cumulative / safeCeiling) * usableH;

  let running = 0;
  const points: SparkPoint[] = sessions.map((s, i) => {
    running += s.count;
    return { x: xFor(i), y: yFor(running), s, i, cumulative: running };
  });

  const lastPoint = points[points.length - 1];
  if (!lastPoint) return { points, linePath: "", areaPath: "" };

  const pointsPath = points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const linePath = `M${PAD_X.toFixed(2)},${baselineY.toFixed(2)} ${pointsPath}`;
  const areaPath = `M${PAD_X.toFixed(2)},${baselineY.toFixed(2)} ${pointsPath} L${lastPoint.x.toFixed(2)},${baselineY.toFixed(2)} Z`;

  return { points, linePath, areaPath };
}

export function GameUnlockTimeline({ appid }: { appid: number }) {
  const query = useGameUnlockTimeline(appid);
  if (query.isPending || !query.data || query.data.unlocks.length === 0) return null;

  const { unlocks, total, achievementCount } = query.data;
  const sessions = detectSessions(unlocks.map((iso) => new Date(iso)));
  if (sessions.length === 0) return null;

  const ceiling = achievementCount && achievementCount > 0 ? achievementCount : total;
  const { points, linePath, areaPath } = buildSparkline(sessions, ceiling);
  const firstSession = sessions[0];
  const lastSession = sessions[sessions.length - 1];
  const isComplete =
    achievementCount !== null && achievementCount > 0 && total >= achievementCount;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          Unlock Timeline
        </h3>
        {isComplete && (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
            100%
          </span>
        )}
      </div>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        When achievements landed.
      </p>
      <div>
        <div className="relative" style={{ height: STRIP_H }}>
          <svg
            viewBox={`0 0 100 ${STRIP_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full text-sky-400"
            aria-hidden="true"
          >
            {achievementCount !== null && achievementCount > 0 && (
              <line
                x1={PAD_X}
                y1={PAD_TOP}
                x2={100 - PAD_X}
                y2={PAD_TOP}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                className={isComplete ? "text-amber-400/60" : "text-muted-foreground/35"}
              />
            )}
            {areaPath && <path d={areaPath} className="fill-sky-500/15" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {achievementCount !== null && achievementCount > 0 && (
            <span
              className={`pointer-events-none absolute right-0 top-0 text-[9px] uppercase tracking-wide tabular-nums ${
                isComplete ? "text-amber-300" : "text-muted-foreground/60"
              }`}
            >
              100%
            </span>
          )}
          {points.map((p) => {
            const duration = sessionDuration(p.s);
            const cumulativeLabel = `${p.cumulative} of ${ceiling}`;
            return (
              <TooltipPrimitive.Root
                key={`${p.s.start.toISOString()}-${p.i}`}
                delayDuration={80}
              >
                <TooltipPrimitive.Trigger asChild>
                  <button
                    type="button"
                    aria-label={`${sessionDate(p.s)}: +${p.s.count} ${p.s.count === 1 ? "unlock" : "unlocks"} (${cumulativeLabel})`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-sky-300/60 bg-sky-400 transition-transform hover:scale-[1.8] focus-visible:scale-[1.8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
                    style={{
                      left: `${p.x}%`,
                      top: p.y,
                      width: DOT_R * 2,
                      height: DOT_R * 2,
                    }}
                  />
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    side="top"
                    sideOffset={6}
                    collisionPadding={8}
                    className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{sessionDate(p.s)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        +{p.s.count} {p.s.count === 1 ? "unlock" : "unlocks"}
                        {duration && (
                          <span className="text-muted-foreground/60"> · {duration}</span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground/80">
                        → {cumulativeLabel}
                      </span>
                    </div>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            );
          })}
        </div>
        {firstSession && lastSession && (
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground/70">
            <span>{DATE_FMT_BOOKEND.format(firstSession.start)}</span>
            {sessions.length > 1 && (
              <span>{DATE_FMT_BOOKEND.format(lastSession.start)}</span>
            )}
          </div>
        )}
      </div>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        {achievementCount !== null && achievementCount > 0
          ? `${total} of ${achievementCount}`
          : total}{" "}
        {Math.max(total, achievementCount ?? 0) === 1 ? "unlock" : "unlocks"} across{" "}
        {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
      </p>
    </div>
  );
}
