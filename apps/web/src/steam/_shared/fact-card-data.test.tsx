import { render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { FactCardData } from "./fact-card-data";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function renderWithMotion(ui: React.ReactElement) {
  return render(<MotionConfig reducedMotion="always">{ui}</MotionConfig>);
}

interface Owned {
  count: number;
}

describe("FactCardData", () => {
  it("renders the pending shell while the query is loading", () => {
    renderWithMotion(
      <FactCardData<Owned>
        query={{ data: undefined, isPending: true, isError: false }}
        title="Library"
        pendingLabel="Loading library…"
      >
        {() => <span>should not render</span>}
      </FactCardData>
    );
    expect(screen.getByText("Library")).toBeTruthy();
    expect(screen.getByText("Loading library…")).toBeTruthy();
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("renders the error shell when isError is true", () => {
    renderWithMotion(
      <FactCardData<Owned>
        query={{ data: undefined, isPending: false, isError: true }}
        title="Library"
        errorLabel="Library is unavailable right now."
      >
        {() => <span>should not render</span>}
      </FactCardData>
    );
    expect(screen.getByText("Library is unavailable right now.")).toBeTruthy();
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("falls back to a default error verdict derived from the title", () => {
    renderWithMotion(
      <FactCardData<Owned>
        query={{ data: undefined, isPending: false, isError: true }}
        title="Wishlist"
      >
        {() => <span>nope</span>}
      </FactCardData>
    );
    expect(screen.getByText("Wishlist is unavailable right now.")).toBeTruthy();
  });

  it("renders the empty shell when isEmpty returns true and emptyLabel is set", () => {
    renderWithMotion(
      <FactCardData<Owned>
        query={{ data: { count: 0 }, isPending: false, isError: false }}
        title="Library"
        emptyLabel="Nothing yet."
        emptyPrescription="First poll lands soon."
        isEmpty={(d) => d.count === 0}
      >
        {() => <span>should not render</span>}
      </FactCardData>
    );
    expect(screen.getByText("Nothing yet.")).toBeTruthy();
    expect(screen.getByText("First poll lands soon.")).toBeTruthy();
    expect(screen.queryByText("should not render")).toBeNull();
  });

  it("delegates to children when the query has data and is not empty", () => {
    renderWithMotion(
      <FactCardData<Owned>
        query={{ data: { count: 42 }, isPending: false, isError: false }}
        title="Library"
        isEmpty={(d) => d.count === 0}
      >
        {(data) => <span data-testid="success">{data.count} games</span>}
      </FactCardData>
    );
    expect(screen.getByTestId("success").textContent).toBe("42 games");
  });

  it("skips the empty branch when isEmpty is unset (success path is taken)", () => {
    renderWithMotion(
      <FactCardData<Owned>
        query={{ data: { count: 0 }, isPending: false, isError: false }}
        title="Library"
      >
        {(data) => <span data-testid="success">count={data.count}</span>}
      </FactCardData>
    );
    expect(screen.getByTestId("success").textContent).toBe("count=0");
  });

  it("passes axe with no violations across the pending/error/empty/success shells", async () => {
    const cases = [
      <FactCardData<Owned>
        key="pending"
        query={{ data: undefined, isPending: true, isError: false }}
        title="Library"
        pendingLabel="Loading…"
      >
        {() => null}
      </FactCardData>,
      <FactCardData<Owned>
        key="error"
        query={{ data: undefined, isPending: false, isError: true }}
        title="Library"
      >
        {() => null}
      </FactCardData>,
      <FactCardData<Owned>
        key="empty"
        query={{ data: { count: 0 }, isPending: false, isError: false }}
        title="Library"
        emptyLabel="Nothing yet."
        isEmpty={(d) => d.count === 0}
      >
        {() => null}
      </FactCardData>,
      <FactCardData<Owned>
        key="success"
        query={{ data: { count: 7 }, isPending: false, isError: false }}
        title="Library"
      >
        {(d) => <p>{d.count} games owned.</p>}
      </FactCardData>,
    ];
    for (const ui of cases) {
      const { container, unmount } = renderWithMotion(ui);
      const results = await axe(container);
      expect(results.violations).toHaveLength(0);
      unmount();
    }
  });
});
