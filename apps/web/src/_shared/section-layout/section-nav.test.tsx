import { fireEvent, render, screen } from "@testing-library/react";
import { LazyMotion, domAnimation } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { type SectionTab, SectionTabRow, SectionTabsDropdown } from "./section-nav";

// Link renders as a plain anchor and forwards the rest of its props (including
// `onClick`) so the `onSelect` seam can be exercised without a router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => {
    const { to, params, search, ...rest } = props;
    return (
      <a href={typeof to === "string" ? to : "#"} {...rest}>
        {children}
      </a>
    );
  },
}));

const Dot: ComponentType<{ className?: string }> = () => <svg aria-hidden />;

function tab(overrides: Partial<SectionTab> = {}): SectionTab {
  return {
    to: "/lol/$accountSlug/matches",
    params: { accountSlug: "vyoh-euw" },
    label: "Matches",
    Icon: Dot,
    active: false,
    ...overrides,
  };
}

function renderRow(tabs: SectionTab[]) {
  return render(
    <LazyMotion features={domAnimation}>
      <SectionTabRow tabs={tabs} indicatorId="t" prefersReducedMotion />
    </LazyMotion>
  );
}

describe("section tab onSelect seam", () => {
  it("fires onSelect when a tab-row link is clicked", () => {
    const onSelect = vi.fn();
    renderRow([tab({ onSelect })]);
    fireEvent.click(screen.getByRole("link", { name: /Matches/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("lets a tab without onSelect click through without throwing", () => {
    renderRow([tab()]);
    expect(() =>
      fireEvent.click(screen.getByRole("link", { name: /Matches/ }))
    ).not.toThrow();
  });

  it("a preventDefault'd onSelect stops the link's default navigation", () => {
    const onSelect = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    renderRow([tab({ onSelect })]);
    const link = screen.getByRole("link", { name: /Matches/ });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("fires onSelect from the section dropdown item", () => {
    const onSelect = vi.fn();
    render(
      <LazyMotion features={domAnimation}>
        <SectionTabsDropdown tabs={[tab({ onSelect })]} onLive={false} />
      </LazyMotion>
    );
    // Open the Radix menu, then click the item.
    fireEvent.click(screen.getByRole("button", { name: "Sections" }));
    fireEvent.click(screen.getByRole("link", { name: /Matches/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
