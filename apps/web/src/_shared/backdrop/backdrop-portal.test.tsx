import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BACKDROP_SHELL_CLASS, BackdropPortal } from "./backdrop-portal";

describe("BackdropPortal", () => {
  it("portals children to document.body", () => {
    const { unmount } = render(
      <BackdropPortal>
        <div data-testid="layer">backdrop</div>
      </BackdropPortal>
    );
    const layer = document.body.querySelector('[data-testid="layer"]');
    expect(layer).not.toBeNull();
    expect(layer?.textContent).toBe("backdrop");
    unmount();
    expect(document.body.querySelector('[data-testid="layer"]')).toBeNull();
  });
});

describe("BACKDROP_SHELL_CLASS", () => {
  it("includes the fixed-inset overflow-hidden pointer-events-none -z-10 shell", () => {
    expect(BACKDROP_SHELL_CLASS).toContain("pointer-events-none");
    expect(BACKDROP_SHELL_CLASS).toContain("fixed");
    expect(BACKDROP_SHELL_CLASS).toContain("inset-0");
    expect(BACKDROP_SHELL_CLASS).toContain("-z-10");
    expect(BACKDROP_SHELL_CLASS).toContain("overflow-hidden");
  });
});
