import { cn } from "@/lib/utils";
import { useRouter } from "@tanstack/react-router";
import type { WebVitalName, WebVitalP75, WebVitalRating } from "@vyoh/shared";
import { CLSThresholds, INPThresholds, LCPThresholds } from "web-vitals";
import { STATUS_TABLE_HEAD_CLASS, StatusCard } from "./status-primitives";
import { useFieldVitals } from "./use-field-vitals";

// The three Core Web Vitals. FCP and TTFB are collected as well, but they
// explain an LCP rather than stand beside it.
const COLUMNS: {
  name: WebVitalName;
  thresholds: readonly [number, number];
  format: (v: number) => string;
}[] = [
  { name: "LCP", thresholds: LCPThresholds, format: (v) => `${(v / 1000).toFixed(2)} s` },
  { name: "INP", thresholds: INPThresholds, format: (v) => `${Math.round(v)} ms` },
  { name: "CLS", thresholds: CLSThresholds, format: (v) => v.toFixed(3) },
];

const RATING_CLASS: Record<WebVitalRating, string> = {
  good: "text-emerald-500",
  "needs-improvement": "text-amber-300",
  poor: "text-destructive",
};

// The same cut web-vitals applies to a single reading, applied to the p75.
function rate(value: number, [good, poor]: readonly [number, number]): WebVitalRating {
  if (value <= good) return "good";
  return value <= poor ? "needs-improvement" : "poor";
}

// An index route's id keeps its trailing slash; the page is the same one.
const pageLabel = (route: string) =>
  route.length > 1 ? route.replace(/\/$/, "") : route;

export function FieldVitalsCard() {
  const { data, isPending, error } = useFieldVitals();
  const { routesById } = useRouter();
  // The api cannot tell a route template from any string in the same charset,
  // so the card keeps to the pages this build's route tree actually has.
  const pages =
    data?.routes.filter((page) => Object.hasOwn(routesById, page.route)) ?? [];

  return (
    <StatusCard
      title="Field vitals"
      description={
        data
          ? `p75 of visitors' page loads over the last ${data.windowDays} days, by landing page. A metric with fewer than ${data.minSamples} samples stays blank.`
          : "p75 of visitors' page loads, by landing page."
      }
    >
      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading field vitals…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Field vitals are unavailable right now.
        </p>
      ) : pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No page has enough samples yet. Each visitor's browser sends them as they leave
          a page.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className={STATUS_TABLE_HEAD_CLASS}>
              <tr>
                <th className="py-2 pr-3 text-left font-medium">Page</th>
                <th className="px-2 py-2 text-left font-medium">Device</th>
                {COLUMNS.map((column) => (
                  <th
                    key={column.name}
                    className="px-2 py-2 text-right font-medium last:pr-0"
                  >
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={`${page.route} ${page.formFactor}`} className="border-t">
                  <td className="py-2 pr-3 font-mono text-xs">{pageLabel(page.route)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{page.formFactor}</td>
                  {COLUMNS.map((column) => (
                    <VitalCell
                      key={column.name}
                      metric={page.metrics[column.name]}
                      column={column}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StatusCard>
  );
}

function VitalCell({
  metric,
  column,
}: {
  metric: WebVitalP75 | undefined;
  column: (typeof COLUMNS)[number];
}) {
  if (!metric) {
    return <td className="px-2 py-2 text-right text-muted-foreground last:pr-0">—</td>;
  }
  return (
    <td className="px-2 py-2 text-right last:pr-0">
      <span
        className={cn("font-mono", RATING_CLASS[rate(metric.p75, column.thresholds)])}
      >
        {column.format(metric.p75)}
      </span>
      <span className="block text-[10px] text-muted-foreground">
        {Math.round(metric.goodShare * 100)}% good · {metric.samples}
      </span>
    </td>
  );
}
