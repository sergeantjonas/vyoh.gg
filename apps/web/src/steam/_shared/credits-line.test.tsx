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
    expect(screen.getByText("FromSoftware Inc.")).toBeTruthy();
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
});
