import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./error-boundary";

function Bomb({ message }: { message: string }): never {
  throw new Error(message);
}

beforeEach(() => {
  // ErrorBoundary intentionally logs to console.error; silence it for clean test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <span>OK</span>
      </ErrorBoundary>
    );
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("renders a static ReactNode fallback when a child throws", () => {
    render(
      <ErrorBoundary fallback={<span>fallback</span>}>
        <Bomb message="boom" />
      </ErrorBoundary>
    );
    expect(screen.getByText("fallback")).toBeTruthy();
  });

  it("calls the fallback render function with the caught error", () => {
    const fallback = vi.fn((e: Error) => <span>err: {e.message}</span>);
    render(
      <ErrorBoundary fallback={fallback}>
        <Bomb message="kaboom" />
      </ErrorBoundary>
    );
    expect(screen.getByText("err: kaboom")).toBeTruthy();
    expect(fallback).toHaveBeenCalled();
  });

  it("invokes onError when a child throws", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={<span>x</span>} onError={onError}>
        <Bomb message="z" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
  });

  it("renders null when no fallback is provided", () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomb message="silent" />
      </ErrorBoundary>
    );
    expect(container.firstChild).toBeNull();
  });
});
