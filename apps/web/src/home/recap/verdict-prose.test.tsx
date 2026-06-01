import { render } from "@testing-library/react";
import type { VerdictClause } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { VerdictProse } from "./verdict-prose";

describe("VerdictProse", () => {
  it("renders an empty paragraph when given no clauses", () => {
    const { container } = render(<VerdictProse clauses={[]} />);
    const p = container.querySelector("p");
    expect(p).toBeTruthy();
    expect(p?.textContent).toBe("");
  });

  it("joins clauses into a single readable sentence with one space between them", () => {
    const clauses: VerdictClause[] = [
      [
        { kind: "emphasis", value: "Aggressive" },
        { kind: "text", value: "." },
      ],
      [
        { kind: "subject", value: "Ahri" },
        { kind: "text", value: " took " },
        { kind: "number", value: "18", raw: 18 },
        { kind: "text", value: " games." },
      ],
    ];
    const { container } = render(<VerdictProse clauses={clauses} />);
    expect(container.textContent).toBe("Aggressive. Ahri took 18 games.");
  });

  it("renders each segment kind with a distinct class signature so motion can target them later", () => {
    const clauses: VerdictClause[] = [
      [
        { kind: "emphasis", value: "Surgical" },
        { kind: "text", value: ". The " },
        { kind: "opponent", value: "Sylas" },
        { kind: "text", value: " game (" },
        { kind: "number", value: "17", raw: 17 },
        { kind: "text", value: ")." },
        { kind: "subject", value: "Ahri" },
      ],
    ];
    const { container } = render(<VerdictProse clauses={clauses} />);
    // Each kind picks up its own font-weight / italic combo so we can grep for
    // "uppercase" for emphasis, "italic" for subject/opponent, "tabular-nums"
    // for numbers — and motion adds onto them in R-2g.
    expect(container.querySelectorAll(".uppercase").length).toBe(1);
    expect(container.querySelectorAll(".italic").length).toBe(2);
    expect(container.querySelectorAll(".tabular-nums").length).toBe(1);
  });

  it("forwards className to the wrapping paragraph", () => {
    const { container } = render(<VerdictProse clauses={[]} className="my-verdict" />);
    expect(container.querySelector("p")?.className).toContain("my-verdict");
  });
});
