import { render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppErrorFallback,
  ChartBoundary,
  ErrorBoundary,
  WidgetBoundary,
  WidgetErrorFallback,
} from "./error-boundary";

const reportError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/report-error", () => ({ reportError }));

function Bomb({ message }: { message: string }): never {
  throw new Error(message);
}

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

beforeEach(() => {
  reportError.mockClear();
  // ErrorBoundary intentionally logs to console.error; silence it for clean test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary tier="widget">
        <span>OK</span>
      </ErrorBoundary>
    );
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("renders a static ReactNode fallback when a child throws", () => {
    render(
      <ErrorBoundary tier="widget" fallback={<span>fallback</span>}>
        <Bomb message="boom" />
      </ErrorBoundary>
    );
    expect(screen.getByText("fallback")).toBeTruthy();
  });

  it("calls the fallback render function with the caught error", () => {
    const fallback = vi.fn((e: Error) => <span>err: {e.message}</span>);
    render(
      <ErrorBoundary tier="widget" fallback={fallback}>
        <Bomb message="kaboom" />
      </ErrorBoundary>
    );
    expect(screen.getByText("err: kaboom")).toBeTruthy();
    expect(fallback).toHaveBeenCalled();
  });

  it("reports the error under its tier", () => {
    render(
      <ErrorBoundary tier="app-root" fallback={<span>x</span>}>
        <Bomb message="tiered" />
      </ErrorBoundary>
    );
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), "app-root");
  });

  // The root boundary's onError plays a sound. Reporting has to survive it
  // rather than be replaced by it.
  it("reports and still calls a caller's onError", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary tier="page" fallback={<span>x</span>} onError={onError}>
        <Bomb message="both" />
      </ErrorBoundary>
    );
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), "page");
    expect(onError).toHaveBeenCalled();
    // Order is the point: a throwing onError must not be able to swallow it.
    expect(reportError.mock.invocationCallOrder[0]).toBeLessThan(
      onError.mock.invocationCallOrder[0] as number
    );
  });

  it("reports widget-tier for a WidgetBoundary", () => {
    render(
      <WidgetBoundary>
        <Bomb message="leaf" />
      </WidgetBoundary>
    );
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), "widget");
  });

  it("invokes onError when a child throws", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary tier="widget" fallback={<span>x</span>} onError={onError}>
        <Bomb message="z" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
  });

  it("renders null when no fallback is provided", () => {
    const { container } = render(
      <ErrorBoundary tier="widget">
        <Bomb message="silent" />
      </ErrorBoundary>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("WidgetBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <WidgetBoundary>
        <span>OK</span>
      </WidgetBoundary>
    );
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("fails small to the compact fallback when a child throws", () => {
    render(
      <WidgetBoundary>
        <Bomb message="boom" />
      </WidgetBoundary>
    );
    expect(screen.getByText("This section is unavailable.")).toBeTruthy();
  });

  it("renders a custom message in the compact fallback", () => {
    render(
      <WidgetBoundary message="This chart is unavailable.">
        <Bomb message="boom" />
      </WidgetBoundary>
    );
    expect(screen.getByText("This chart is unavailable.")).toBeTruthy();
  });

  it("fails silently to null for decorative leaves (fallback={null})", () => {
    const { container } = render(
      <WidgetBoundary fallback={null}>
        <Bomb message="silent" />
      </WidgetBoundary>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("AppErrorFallback", () => {
  it("renders the title and a reload affordance", () => {
    render(<AppErrorFallback />);
    expect(screen.getByText("Something went wrong.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("shows the error message when an error is threaded through", () => {
    render(<AppErrorFallback error={new Error("downstream blew up")} />);
    expect(screen.getByText("downstream blew up")).toBeTruthy();
  });

  it("omits the error message for the static root fallback", () => {
    render(<AppErrorFallback title="static root fallback" />);
    expect(screen.getByText("static root fallback")).toBeTruthy();
    expect(screen.queryByText(/blew up/)).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<AppErrorFallback error={new Error("x")} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});

describe("ChartBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ChartBoundary>
        <span>chart</span>
      </ChartBoundary>
    );
    expect(screen.getByText("chart")).toBeTruthy();
  });

  it("fails small to the chart-specific message when a child throws", () => {
    render(
      <ChartBoundary>
        <Bomb message="recharts blew up" />
      </ChartBoundary>
    );
    expect(screen.getByText("This chart is unavailable.")).toBeTruthy();
  });
});

describe("WidgetErrorFallback", () => {
  it("renders the default message", () => {
    render(<WidgetErrorFallback />);
    expect(screen.getByText("This section is unavailable.")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <WidgetErrorFallback message="This chart is unavailable." />
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
