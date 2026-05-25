import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreditsLine } from "./credits-line";

describe("CreditsLine", () => {
  it("renders all three segments joined with `·`", () => {
    render(
      <CreditsLine
        developers={["FromSoftware Inc."]}
        publishers={["Bandai Namco"]}
        franchises={["Elden Ring"]}
      />
    );
    // Corporate suffix is stripped (separate test below covers the tidying).
    expect(screen.getByText("FromSoftware")).toBeTruthy();
    expect(screen.getByText("Published by")).toBeTruthy();
    expect(screen.getByText("Bandai Namco")).toBeTruthy();
    expect(screen.getByText("Franchise")).toBeTruthy();
    expect(screen.getByText("Elden Ring")).toBeTruthy();
  });

  it("joins multi-entry arrays with `, `", () => {
    render(
      <CreditsLine
        developers={["Studio A", "Studio B"]}
        publishers={[]}
        franchises={[]}
      />
    );
    expect(screen.getByText("Studio A, Studio B")).toBeTruthy();
  });

  it("omits a segment whose array is empty", () => {
    const { container } = render(
      <CreditsLine
        developers={["Capcom"]}
        publishers={[]}
        franchises={["Resident Evil"]}
      />
    );
    expect(container.textContent).not.toContain("Published by");
    expect(screen.getByText("Capcom")).toBeTruthy();
    expect(screen.getByText("Resident Evil")).toBeTruthy();
  });

  it("returns null when all arrays are empty", () => {
    const { container } = render(
      <CreditsLine developers={[]} publishers={[]} franchises={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("strips trailing corporate suffixes from entity names", () => {
    render(
      <CreditsLine
        developers={["FromSoftware, Inc."]}
        publishers={["Bandai Namco Entertainment"]}
        franchises={[]}
      />
    );
    expect(screen.getByText("FromSoftware")).toBeTruthy();
    expect(screen.getByText("Bandai Namco")).toBeTruthy();
  });

  it("strips compound corporate suffixes (`Co., Ltd.`)", () => {
    render(
      <CreditsLine developers={["Capcom Co., Ltd."]} publishers={[]} franchises={[]} />
    );
    expect(screen.getByText("Capcom")).toBeTruthy();
  });

  it("drops a publisher that equals the developer after tidying", () => {
    const { container } = render(
      <CreditsLine
        developers={["FromSoftware, Inc."]}
        publishers={["FromSoftware, Inc."]}
        franchises={[]}
      />
    );
    expect(container.textContent).not.toContain("Published by");
    expect(screen.getByText("FromSoftware")).toBeTruthy();
  });

  it("drops only the duplicate publisher entries, keeping unique ones", () => {
    render(
      <CreditsLine
        developers={["FromSoftware, Inc."]}
        publishers={["Bandai Namco Entertainment", "FromSoftware, Inc."]}
        franchises={[]}
      />
    );
    expect(screen.getByText("Published by")).toBeTruthy();
    expect(screen.getByText("Bandai Namco")).toBeTruthy();
    // FromSoftware appears only ONCE in the rendered output, not twice.
    expect(screen.getAllByText("FromSoftware")).toHaveLength(1);
  });

  it("preserves a name that is *only* a stripped suffix (would-be empty)", () => {
    // Edge case: an entity literally named "Studios" or "Interactive" should
    // not collapse to an empty string. The helper falls back to the original.
    render(<CreditsLine developers={["Studios"]} publishers={[]} franchises={[]} />);
    expect(screen.getByText("Studios")).toBeTruthy();
  });
});
