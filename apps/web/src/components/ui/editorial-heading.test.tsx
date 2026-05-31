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

  it("splits a single-line string into per-word motion spans", () => {
    const { container } = render(<EditorialHeading>A self-portrait</EditorialHeading>);
    const words = container.querySelectorAll("[data-slot='editorial-word']");
    expect(words.length).toBe(2);
    expect(words[0]?.textContent).toBe("A");
    expect(words[1]?.textContent).toBe("self-portrait");
  });

  it("renders multi-line as block-display lines, each with its own word stagger", () => {
    const { container } = render(
      <EditorialHeading>{["A self-portrait,", "in League and Steam."]}</EditorialHeading>
    );
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el?.textContent).toBe("A self-portrait,in League and Steam.");
    const lines = el?.querySelectorAll(":scope > span.block");
    expect(lines?.length).toBe(2);
    const words = container.querySelectorAll("[data-slot='editorial-word']");
    // "A" "self-portrait," + "in" "League" "and" "Steam." = 2 + 4
    expect(words.length).toBe(6);
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

  it("applies lineClassName positionally to each block-display line", () => {
    const { container } = render(
      <EditorialHeading lineClassName={[undefined, "muted-line"]}>
        {["A self-portrait,", "in League and Steam."]}
      </EditorialHeading>
    );
    const lines = container.querySelectorAll(
      "[data-slot='editorial-heading'] > span.block"
    );
    expect(lines.length).toBe(2);
    expect(lines[0]?.className).not.toContain("muted-line");
    expect(lines[1]?.className).toContain("muted-line");
  });

  it("flags the delegated mode on the data attribute and still renders per-word spans for cascade", () => {
    const { container } = render(
      <EditorialHeading delegated>A self-portrait</EditorialHeading>
    );
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el?.getAttribute("data-delegated")).toBe("true");
    expect(container.querySelectorAll("[data-slot='editorial-word']").length).toBe(2);
  });

  it("omits the data-delegated attribute by default", () => {
    const { container } = render(<EditorialHeading>Hi</EditorialHeading>);
    expect(
      container
        .querySelector("[data-slot='editorial-heading']")
        ?.hasAttribute("data-delegated")
    ).toBe(false);
  });

  it("falls back to an opacity-only fade with no per-word spans when reduced motion is requested", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <EditorialHeading>{["A self-portrait,", "in League and Steam."]}</EditorialHeading>
    );
    const el = container.querySelector("[data-slot='editorial-heading']");
    expect(el?.getAttribute("data-reduced-motion")).toBe("true");
    expect(container.querySelectorAll("[data-slot='editorial-word']").length).toBe(0);
    expect(el?.querySelectorAll(":scope > span.block").length).toBe(2);
    expect(el?.textContent).toBe("A self-portrait,in League and Steam.");
  });
});
