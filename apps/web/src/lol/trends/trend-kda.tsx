import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KdaPoint } from "./trend-stats";

function KdaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {active && payload?.length ? (
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="rounded-md border bg-popover/85 px-3 py-2 text-sm text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="mb-0.5 text-xs text-muted-foreground">Game {label}</div>
          <div className="font-semibold">{Number(payload[0]?.value).toFixed(2)} KDA</div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export function TrendKda({ points }: { points: KdaPoint[] }) {
  const reduced = useReducedMotion();
  return (
    <m.section
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
        delay: reduced ? 0 : 0.32,
      }}
    >
      <h3 className="text-sm font-medium text-muted-foreground">KDA trend</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <defs>
              <linearGradient id="kda-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="game"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={32} />
            <Tooltip
              content={<KdaTooltip />}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="kda"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3, fill: "#34d399", stroke: "#34d399" }}
              activeDot={{ r: 5, fill: "#34d399", stroke: "#34d399" }}
              fill="url(#kda-area)"
              animationDuration={reduced ? 0 : 1800}
              animationBegin={reduced ? 0 : 480}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </m.section>
  );
}
