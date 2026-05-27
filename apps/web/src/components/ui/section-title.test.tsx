import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTitle } from "./section-title";

describe("SectionTitle", () => {
  it("renders an h3 by default with the editorial classes", () => {
    const { container } = render(<SectionTitle>Roles</SectionTitle>);
    const el = container.querySelector("[data-slot='section-title']");
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe("H3");
    expect(el?.className).toContain("uppercase");
    expect(el?.className).toContain("text-sm");
    expect(el?.className).toContain("font-semibold");
    expect(el?.className).toContain("tracking-[0.2em]");
    expect(el?.className).toContain("text-foreground");
    expect(el?.className).not.toContain("text-foreground/70");
    expect(el?.textContent).toBe("Roles");
  });

  it("honours the as prop to render a different heading level", () => {
    const { container } = render(<SectionTitle as="h2">Stats</SectionTitle>);
    expect(container.querySelector("[data-slot='section-title']")?.tagName).toBe("H2");
  });

  it("merges className", () => {
    const { container } = render(
      <SectionTitle className="x-extra">Synergy</SectionTitle>
    );
    expect(container.querySelector("[data-slot='section-title']")?.className).toContain(
      "x-extra"
    );
  });
});
