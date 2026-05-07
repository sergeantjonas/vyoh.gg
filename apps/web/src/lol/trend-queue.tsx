import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QueueCount } from "./trend-stats";

const PALETTE = [
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb923c", // orange
];

function gradientId(color: string) {
  return `queue-bar-${color.slice(1)}`;
}

export function TrendQueue({ counts }: { counts: QueueCount[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Queue distribution</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={counts}>
            <defs>
              {PALETTE.map((color) => (
                <linearGradient
                  key={color}
                  id={gradientId(color)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="queueType"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              animationDuration={1100}
              animationBegin={150}
              animationEasing="ease-out"
            >
              {counts.map((entry, i) => (
                <Cell
                  key={entry.queueType}
                  fill={`url(#${gradientId(PALETTE[i % PALETTE.length] as string)})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
