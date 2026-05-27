import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardTitle } from "./card-title";

describe("CardTitle", () => {
  it("renders an h3 by default with the quieter in-chrome classes", () => {
    const { container } = render(<CardTitle>About this game</CardTitle>);
    const el = container.querySelector("[data-slot='card-title']");
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe("H3");
    expect(el?.className).toContain("uppercase");
    expect(el?.className).toContain("text-sm");
    expect(el?.className).toContain("font-medium");
    expect(el?.className).toContain("tracking-[0.2em]");
    expect(el?.className).toContain("text-foreground/70");
    expect(el?.textContent).toBe("About this game");
  });

  it("honours the as prop to render a different heading level", () => {
    const { container } = render(<CardTitle as="h2">Achievements</CardTitle>);
    expect(container.querySelector("[data-slot='card-title']")?.tagName).toBe("H2");
  });

  it("merges className", () => {
    const { container } = render(
      <CardTitle className="x-extra">Unlock Timeline</CardTitle>
    );
    expect(container.querySelector("[data-slot='card-title']")?.className).toContain(
      "x-extra"
    );
  });
});
