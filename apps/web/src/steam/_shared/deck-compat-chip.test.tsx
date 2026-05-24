import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeckCompatChip } from "./deck-compat-chip";

describe("DeckCompatChip", () => {
  it("renders 'Deck Verified' for tier 3", () => {
    render(<DeckCompatChip tier={3} />);
    expect(screen.getByText("Deck Verified")).toBeTruthy();
  });

  it("renders 'Deck Playable' for tier 2", () => {
    render(<DeckCompatChip tier={2} />);
    expect(screen.getByText("Deck Playable")).toBeTruthy();
  });

  it("renders 'Not on Deck' for tier 1", () => {
    render(<DeckCompatChip tier={1} />);
    expect(screen.getByText("Not on Deck")).toBeTruthy();
  });

  it("renders nothing for tier 0 (Unknown) so the chip is silent on no-data", () => {
    const { container } = render(<DeckCompatChip tier={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when tier is null (no enrichment row)", () => {
    const { container } = render(<DeckCompatChip tier={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for unrecognised tier values", () => {
    const { container } = render(<DeckCompatChip tier={99} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies the md-size sizing classes when size='md'", () => {
    const { container } = render(<DeckCompatChip tier={3} size="md" />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain("text-xs");
  });
});
