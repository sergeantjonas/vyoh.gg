import { m, useReducedMotion } from "motion/react";
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
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(label) => `Game ${label}`}
              formatter={(value) => [Number(value).toFixed(2), "KDA"]}
            />
            <Line
              type="monotone"
              dataKey="kda"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3, fill: "#34d399", stroke: "#34d399" }}
              activeDot={{ r: 5, fill: "#34d399", stroke: "#34d399" }}
              fill="url(#kda-area)"
              animationDuration={1800}
              animationBegin={reduced ? 0 : 480}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </m.section>
  );
}
