// Visually-hidden data-table fallback for charts — the most portable chart-a11y
// pattern (KB frontend-2026 §20 5.2): screen readers get first-class table
// navigation (row/column headers, cell-by-cell traversal) for data that the
// chart otherwise exposes only on :hover. It also doubles as a "show me the
// numbers" affordance. Render it beside the chart; the chart keeps its own
// `role="img"`/`aria-label` (or `accessibilityLayer` for Recharts).
//
// For SVG/canvas charts with no other a11y path (custom heatmaps), this table
// is the *only* screen-reader surface — keep the cell values plain text.
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ChartDataColumn<Row> {
  /** Stable identity for the column; also the React key for header/cells. */
  key: string;
  /** Column header text, rendered as `<th scope="col">`. */
  header: string;
  /** Cell content for a row — return a string/number for the cleanest SR output. */
  cell: (row: Row) => ReactNode;
}

interface ChartDataTableProps<Row> {
  /** Describes what the chart shows; rendered as the table `<caption>`. */
  caption: string;
  columns: ChartDataColumn<Row>[];
  rows: Row[];
  /** Stable key per row. */
  rowKey: (row: Row, index: number) => string | number;
  /**
   * Which column identifies each row (rendered as `<th scope="row">` instead of
   * `<td>`). Defaults to the first column; pass `-1` for no row header.
   */
  rowHeaderIndex?: number;
  className?: string;
}

export function ChartDataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  rowHeaderIndex = 0,
  className,
}: ChartDataTableProps<Row>) {
  // `sr-only` must wrap the table in a block element — applied directly to
  // `<table>`, the visually-hidden clip leaks: auto table-layout ignores the
  // 1px width and `display:table` boxes don't honor `overflow:hidden`, so the
  // absolutely-positioned table escapes its clip and paints over the layout.
  return (
    <div className={cn("sr-only", className)}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={rowKey(row, r)}>
              {columns.map((col, c) =>
                c === rowHeaderIndex ? (
                  <th key={col.key} scope="row">
                    {col.cell(row)}
                  </th>
                ) : (
                  <td key={col.key}>{col.cell(row)}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
