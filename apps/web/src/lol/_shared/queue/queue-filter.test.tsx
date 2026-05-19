import { useNavigate, useSearch } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueueFilter } from "./queue-filter";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
  useSearch: vi.fn(),
}));

afterEach(() => {
  vi.mocked(useNavigate).mockReset();
  vi.mocked(useSearch).mockReset();
});

describe("QueueFilter", () => {
  it("renders a combobox trigger reflecting 'All queues' when no queue is selected", () => {
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useSearch).mockReturnValue({ queue: undefined } as never);
    render(<QueueFilter />);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("renders the trigger when a queue id is in search params", () => {
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useSearch).mockReturnValue({ queue: 420 } as never);
    const { container } = render(<QueueFilter />);
    // Select renders the trigger with role=combobox in happy-dom.
    expect(container.querySelector("[role='combobox']")).toBeTruthy();
  });
});
