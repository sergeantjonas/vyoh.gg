import { render, screen, within } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { ChartDataTable } from "./chart-data-table";

interface Point {
  game: number;
  kda: number;
}

const points: Point[] = [
  { game: 1, kda: 3.5 },
  { game: 2, kda: 4.2 },
  { game: 3, kda: 2.1 },
];

const columns = [
  { key: "game", header: "Game", cell: (p: Point) => `Game ${p.game}` },
  { key: "kda", header: "KDA", cell: (p: Point) => p.kda.toFixed(2) },
];

function renderTable() {
  return render(
    <ChartDataTable
      caption="KDA per game"
      columns={columns}
      rows={points}
      rowKey={(p) => p.game}
    />
  );
}

// color-contrast needs real computed styles (happy-dom has none); the rest run.
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

describe("ChartDataTable", () => {
  it("renders a captioned table with column headers", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "KDA per game" });
    expect(within(table).getByRole("columnheader", { name: "Game" })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "KDA" })).toBeTruthy();
  });

  it("renders one body row per data point with the first column as a row header", () => {
    renderTable();
    // 3 data rows, each with a scope="row" header cell.
    expect(screen.getAllByRole("rowheader")).toHaveLength(3);
    expect(screen.getByRole("rowheader", { name: "Game 2" })).toBeTruthy();
    // Non-header columns render as data cells.
    expect(screen.getByRole("cell", { name: "4.20" })).toBeTruthy();
  });

  it("is visually hidden via an sr-only block wrapper (not the table itself)", () => {
    renderTable();
    const table = screen.getByRole("table");
    // sr-only must live on a block wrapper — applied to <table> the clip leaks.
    expect(table.className).not.toContain("sr-only");
    expect(table.closest(".sr-only")).not.toBeNull();
  });

  it("honours rowHeaderIndex = -1 by rendering every cell as data", () => {
    render(
      <ChartDataTable
        caption="No row headers"
        columns={columns}
        rows={points}
        rowKey={(p) => p.game}
        rowHeaderIndex={-1}
      />
    );
    expect(screen.queryAllByRole("rowheader")).toHaveLength(0);
    expect(screen.getByRole("cell", { name: "Game 1" })).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderTable();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
