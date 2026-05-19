import { useIsFetching } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchProgress } from "./fetch-progress";

vi.mock("@tanstack/react-query", () => ({
  useIsFetching: vi.fn(),
}));

afterEach(() => {
  vi.mocked(useIsFetching).mockReset();
});

describe("FetchProgress", () => {
  it("renders nothing when no queries are fetching", () => {
    vi.mocked(useIsFetching).mockReturnValue(0);
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <FetchProgress />
      </MotionConfig>
    );
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("renders the progress bar when at least one query is fetching", () => {
    vi.mocked(useIsFetching).mockReturnValue(2);
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <FetchProgress />
      </MotionConfig>
    );
    expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
  });
});
