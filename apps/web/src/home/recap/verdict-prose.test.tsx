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

  // The CountUp primitive bypasses the motion pipeline in test mode and
  // renders its final value immediately, so these assertions check the
  // structural wiring (the value the consumer would see post-animation)
  // rather than the per-frame tween.
  it("animates integer number segments via CountUp using the raw value", () => {
    const clauses: VerdictClause[] = [
      [
        { kind: "number", value: "76", raw: 76 },
        { kind: "text", value: " games." },
      ],
    ];
    const { container } = render(<VerdictProse clauses={clauses} />);
    expect(container.textContent).toBe("76 games.");
  });

  it("preserves the percent suffix when animating a percentage segment", () => {
    const clauses: VerdictClause[] = [
      [
        { kind: "number", value: "55%", raw: 55 },
        { kind: "text", value: " win rate." },
      ],
    ];
    const { container } = render(<VerdictProse clauses={clauses} />);
    // The CountUp renders the digit; the suffix is rendered as a sibling
    // so the integer can tween while the "%" stays static throughout.
    expect(container.textContent).toBe("55% win rate.");
  });

  it("preserves decimal precision on a fractional number segment", () => {
    const clauses: VerdictClause[] = [
      [
        { kind: "number", value: "3.22", raw: 3.22 },
        { kind: "text", value: " avg KDA." },
      ],
    ];
    const { container } = render(<VerdictProse clauses={clauses} />);
    expect(container.textContent).toBe("3.22 avg KDA.");
  });

  it("falls back to a static render for compound number values like KDA scores", () => {
    // The signature-game receipt emits `{ kind: "number", value: "24/7/14",
    // raw: 24 }` — `raw` is just the kill count, so animating would silently
    // collapse the segment to "24". The simple-number pattern below the
    // VerdictProse switch detects the slash and renders the value verbatim.
    const clauses: VerdictClause[] = [
      [
        { kind: "text", value: "Best night: " },
        { kind: "number", value: "24/7/14", raw: 24 },
        { kind: "text", value: "." },
      ],
    ];
    const { container } = render(<VerdictProse clauses={clauses} />);
    expect(container.textContent).toBe("Best night: 24/7/14.");
  });
});
