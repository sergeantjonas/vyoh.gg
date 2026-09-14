import { type ChartDataColumn, ChartDataTable } from "@/components/chart-data-table";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { formatHoursMinutes, hourMatrixTotalMinutes } from "@vyoh/shared";
import type { CSSProperties } from "react";
import { useSteamSessions } from "./use-sessions";

const TITLE = "When you play";
const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAYS = DAY_LABELS.map((name, weekday) => ({ name, short: name[0] ?? "", weekday }));
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GRID_COLS = "1.75rem repeat(24, 1fr)";

/** Below this the matrix is a handful of dots, not a rhythm. */
const MIN_TOTAL_MINUTES = 5 * 60;

interface Cell {
  weekday: number;
  hour: number;
  minutes: number;
}

// Single hue, light to dark, on the section's own accent: the matrix answers
// "how much", so it is a sequential ramp and nothing else — no second hue for
// the cell that happens to be the maximum, which gets a ring instead. The
// share is against the fullest cell rather than a fixed scale, so a light
// month still shows its shape.
function cellStyle(minutes: number, max: number): CSSProperties {
  if (minutes === 0 || max === 0) return {};
  const share = 0.25 + 0.7 * (minutes / max);
  return {
    backgroundColor: `color-mix(in oklch, var(--color-theme-strong) ${Math.round(share * 100)}%, transparent)`,
  };
}

function cellLabel(cell: Cell): string {
  return `${DAY_LABELS[cell.weekday] ?? "?"} ${String(cell.hour).padStart(2, "0")}:00 · ${formatHoursMinutes(cell.minutes)}`;
}

function HeatmapCell({
  cell,
  max,
  highlight,
}: {
  cell: Cell;
  max: number;
  highlight: boolean;
}) {
  const box = (
    <div
      className={`aspect-square rounded-sm ${cell.minutes === 0 ? "bg-muted/20" : ""} ${highlight ? "ring-1 ring-foreground/40 ring-offset-[1px]" : ""}`}
      style={cellStyle(cell.minutes, max)}
    />
  );
  if (cell.minutes === 0) return box;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{box}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_COMPACT}
        >
          {cellLabel(cell)}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

const TABLE_COLUMNS: ChartDataColumn<Cell>[] = [
  {
    key: "slot",
    header: "Slot",
    cell: (c) => `${DAY_LABELS[c.weekday] ?? "?"} ${c.hour}:00`,
  },
  { key: "minutes", header: "Played", cell: (c) => formatHoursMinutes(c.minutes) },
];

function toCells(matrix: number[][]): Cell[] {
  const cells: Cell[] = [];
  for (const [weekday, row] of matrix.entries()) {
    for (const [hour, minutes] of row.entries()) cells.push({ weekday, hour, minutes });
  }
  return cells;
}

/** The fullest played cell, or null when nothing was played. */
function fullestCell(cells: readonly Cell[]): Cell | null {
  return cells.reduce<Cell | null>(
    (acc, c) => (c.minutes > 0 && (acc === null || c.minutes > acc.minutes) ? c : acc),
    null
  );
}

function HeatmapGrid({ matrix, best }: { matrix: number[][]; best: Cell | null }) {
  const max = Math.max(0, ...matrix.flat());
  // One reveal on the grid, not one per cell: the LoL sibling staggers 168
  // cells and each animating opacity promotes its own layer for the duration
  // — measured here at 156–180 load layers against a 36 budget. A single
  // fade keeps the entrance and costs one layer.
  return (
    <div className="heatmap-cell flex flex-col gap-0.5">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: GRID_COLS }}>
        <div />
        {HOURS.map((h) => (
          <div
            key={`hour-${h}`}
            className="text-center text-[9px] text-muted-foreground/60 leading-none"
          >
            {h % 6 === 0 ? String(h) : ""}
          </div>
        ))}
      </div>
      {DAYS.map(({ name, short: label, weekday }) => (
        <div
          key={name}
          className="grid items-center gap-0.5"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="pr-1 text-right text-[9px] text-muted-foreground/60 leading-none">
            {label}
          </div>
          {HOURS.map((hour) => {
            const cell: Cell = { weekday, hour, minutes: matrix[weekday]?.[hour] ?? 0 };
            return (
              <HeatmapCell
                key={`cell-${weekday}-${hour}`}
                cell={cell}
                max={max}
                highlight={
                  best !== null && best.weekday === weekday && best.hour === hour
                }
              />
            );
          })}
        </div>
      ))}
      <p className="pt-1 text-[10px] text-muted-foreground/60">
        Minutes played per weekday and hour, Brussels time. Darker is more.
      </p>
    </div>
  );
}

// The Steam sibling of the LoL "When you play" card, counting minutes rather
// than games: a session that runs 22:40 → 02:52 lights five cells across two
// weekdays. The verdict names the fullest cell — the "usual slot" the beat
// model already refers to, so the hero and this card agree on the word.
export function HourHeatmapCard() {
  const query = useSteamSessions();
  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the log…"
      errorLabel="The rhythm is unavailable right now."
      emptyLabel={`Under ${MIN_TOTAL_MINUTES / 60} hours observed in the window — not enough to see a rhythm yet.`}
      emptyPrescription="Sessions exist only where the api was running; the matrix fills in as it watches."
      isEmpty={(d) => hourMatrixTotalMinutes(d.hourMatrix) < MIN_TOTAL_MINUTES}
    >
      {({ hourMatrix, window: sessionWindow }) => {
        const cells = toCells(hourMatrix);
        const best = fullestCell(cells);
        const total = hourMatrixTotalMinutes(hourMatrix);
        return (
          <FactCard
            title={TITLE}
            metric={sessionWindow.sessionCount}
            metricLabel={{ singular: "session", plural: "sessions" }}
            verdict={
              best
                ? `Usual slot: ${DAY_LABELS[best.weekday]} around ${String(best.hour).padStart(2, "0")}:00 — ${formatHoursMinutes(best.minutes)} of ${formatHoursMinutes(total)} in the window.`
                : `${formatHoursMinutes(total)} observed in the window.`
            }
            evidence={
              <>
                <HeatmapGrid matrix={hourMatrix} best={best} />
                <ChartDataTable
                  caption="Minutes played by weekday and hour — slots with any play"
                  columns={TABLE_COLUMNS}
                  rows={cells.filter((c) => c.minutes > 0)}
                  rowKey={(c) => c.weekday * 24 + c.hour}
                />
              </>
            }
          />
        );
      }}
    </FactCardData>
  );
}
