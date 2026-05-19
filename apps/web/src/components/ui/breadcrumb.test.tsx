import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

describe("Breadcrumb", () => {
  it("wraps a labelled <nav> with the breadcrumb slot", () => {
    const { container } = render(<Breadcrumb />);
    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("breadcrumb");
    expect(nav?.getAttribute("data-slot")).toBe("breadcrumb");
  });

  it("renders a list with items, links, and a current page", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/lol">LoL</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Match</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    const link = screen.getByRole("link", { name: "LoL" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lol");
    const page = screen.getByText("Match");
    expect(page.getAttribute("aria-current")).toBe("page");
  });

  it("renders BreadcrumbLink as a Slot when asChild", () => {
    render(
      <BreadcrumbLink asChild>
        <span data-testid="custom">x</span>
      </BreadcrumbLink>
    );
    const el = screen.getByTestId("custom");
    expect(el.tagName).toBe("SPAN");
    expect(el.getAttribute("data-slot")).toBe("breadcrumb-link");
  });

  it("BreadcrumbEllipsis renders the sr-only More label", () => {
    render(<BreadcrumbEllipsis />);
    expect(screen.getByText("More")).toBeTruthy();
  });

  it("BreadcrumbSeparator renders the default chevron when no children are provided", () => {
    const { container } = render(<BreadcrumbSeparator />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
