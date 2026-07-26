import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

import { RouteErrorFallback } from "./route-error";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const props = (over: Partial<Parameters<typeof RouteErrorFallback>[0]> = {}) =>
  ({
    error: new Error("upstream unreachable"),
    reset: vi.fn(),
    info: undefined,
    ...over,
  }) as Parameters<typeof RouteErrorFallback>[0];

afterEach(() => {
  invalidate.mockClear();
  vi.restoreAllMocks();
});

describe("RouteErrorFallback", () => {
  it("shows the failure and the underlying message", () => {
    render(<RouteErrorFallback {...props()} />);

    expect(screen.getByText("This section could not load.")).toBeTruthy();
    expect(screen.getByText("upstream unreachable")).toBeTruthy();
  });

  it("renders without a message when the error carries none", () => {
    render(<RouteErrorFallback {...props({ error: new Error("") })} />);

    expect(screen.getByText("This section could not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  // Resetting alone re-renders straight back into the cached rejection — the
  // invalidate is what actually re-runs the loader that failed.
  it("resets the boundary and re-runs the loader on retry", async () => {
    const reset = vi.fn();
    invalidate.mockResolvedValue(undefined);
    render(<RouteErrorFallback {...props({ reset })} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
    await waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
  });

  it("disables the button while the retry is in flight", async () => {
    let settle: (() => void) | undefined;
    invalidate.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );
    render(<RouteErrorFallback {...props()} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    const retrying = screen.getByRole("button", { name: "Retrying…" });
    expect(retrying.hasAttribute("disabled")).toBe(true);

    settle?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy()
    );
  });

  it("has no axe violations", async () => {
    const { container } = render(<RouteErrorFallback {...props()} />);

    const results = await axe(container);

    expect(results.violations).toHaveLength(0);
  });
});
