import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";

import { EditorialHeading } from "./editorial-heading";

const useReducedMotionMock = vi.mocked(useReducedMotion);

describe("EditorialHeading", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  it("renders an h1 by default with the supplied text", () => {
    const { container } = render(<EditorialHeading>A self-portrait</EditorialHeading>);
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe("H1");
    expect(el?.textContent).toBe("A self-portrait");
  });

  it("honours the as prop to render a different heading level", () => {
    const { container } = render(<EditorialHeading as="h2">Roles</EditorialHeading>);
    expect(container.querySelector("[data-slot='editorial-heading']")?.tagName).toBe(
      "H2"
    );
  });

  it("renders a single block-level motion line for a single-string heading (no per-word split)", () => {
    const { container } = render(<EditorialHeading>A self-portrait</EditorialHeading>);
    const lines = container.querySelectorAll("[data-slot='editorial-line']");
    expect(lines.length).toBe(1);
    expect(lines[0]?.textContent).toBe("A self-portrait");
    // The earlier per-word stagger reveal is gone — there should be no
    // editorial-word spans anywhere in the tree.
    expect(container.querySelectorAll("[data-slot='editorial-word']").length).toBe(0);
  });

  it("renders multi-line as block-display lines, each as its own motion block (line stagger only)", () => {
    const { container } = render(
      <EditorialHeading>{["A self-portrait,", "in League and Steam."]}</EditorialHeading>
    );
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el?.textContent).toBe("A self-portrait,in League and Steam.");
    const lines = container.querySelectorAll("[data-slot='editorial-line']");
    expect(lines.length).toBe(2);
    expect(lines[0]?.textContent).toBe("A self-portrait,");
    expect(lines[1]?.textContent).toBe("in League and Steam.");
  });

  it("defaults magnitude to medium and reflects it on the data attribute", () => {
    const { container } = render(<EditorialHeading>Hi</EditorialHeading>);
    expect(
      container
        .querySelector("[data-slot='editorial-heading']")
        ?.getAttribute("data-magnitude")
    ).toBe("medium");
  });

  it("honours the magnitude prop", () => {
    const { container } = render(
      <EditorialHeading magnitude="large">Hi</EditorialHeading>
    );
    expect(
      container
        .querySelector("[data-slot='editorial-heading']")
        ?.getAttribute("data-magnitude")
    ).toBe("large");
  });

  it("merges className", () => {
    const { container } = render(
      <EditorialHeading className="x-extra">Hi</EditorialHeading>
    );
    expect(
      container.querySelector("[data-slot='editorial-heading']")?.className
    ).toContain("x-extra");
  });

  it("forwards ref to the underlying heading element via the React 19 ref-as-prop", () => {
    const captured: { node: HTMLHeadingElement | null } = { node: null };
    render(
      <EditorialHeading
        ref={(node) => {
          captured.node = node;
        }}
      >
        Hi
      </EditorialHeading>
    );
    expect(captured.node).not.toBeNull();
    expect(captured.node?.tagName).toBe("H1");
  });

  it("applies lineClassName positionally to each line block", () => {
    const { container } = render(
      <EditorialHeading lineClassName={[undefined, "muted-line"]}>
        {["A self-portrait,", "in League and Steam."]}
      </EditorialHeading>
    );
    const lines = container.querySelectorAll("[data-slot='editorial-line']");
    expect(lines.length).toBe(2);
    expect(lines[0]?.className).not.toContain("muted-line");
    expect(lines[1]?.className).toContain("muted-line");
  });

  it("flags the delegated mode on the data attribute", () => {
    const { container } = render(
      <EditorialHeading delegated>A self-portrait</EditorialHeading>
    );
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el?.getAttribute("data-delegated")).toBe("true");
  });

  it("omits the data-delegated attribute by default", () => {
    const { container } = render(<EditorialHeading>Hi</EditorialHeading>);
    expect(
      container
        .querySelector("[data-slot='editorial-heading']")
        ?.hasAttribute("data-delegated")
    ).toBe(false);
  });

  it("falls back to plain block lines (no editorial-line motion spans) when reduced motion is requested", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <EditorialHeading>{["A self-portrait,", "in League and Steam."]}</EditorialHeading>
    );
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el?.getAttribute("data-reduced-motion")).toBe("true");
    expect(container.querySelectorAll("[data-slot='editorial-line']").length).toBe(0);
    expect(el?.querySelectorAll(":scope > span.block").length).toBe(2);
    expect(el?.textContent).toBe("A self-portrait,in League and Steam.");
  });
});
