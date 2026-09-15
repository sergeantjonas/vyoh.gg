import { fireEvent, render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { IdentityLink } from "./identity-link";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
    ...props
  }: { children: ReactNode; params?: unknown; search?: unknown }) => (
    <a {...props} data-params={JSON.stringify(params ?? null)}>
      {children}
    </a>
  ),
}));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

describe("IdentityLink", () => {
  it("links the avatar and name to the profile, named for screen readers, and hands the click to the morph", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <IdentityLink
        to="/lol/$accountSlug"
        params={{ accountSlug: "vyoh" }}
        preserveSearch
        label="Vyoh#EUW — account profile"
        onClick={onClick}
      >
        <img alt="" src="x.png" />
        <span data-identity-name="">Vyoh</span>
      </IdentityLink>
    );
    // The router mock renders a bare anchor with no href, so there is no link
    // role to query; the accessible name is what matters here.
    const link = screen.getByLabelText("Vyoh#EUW — account profile");
    expect(link.getAttribute("to")).toBe("/lol/$accountSlug");
    expect(link.getAttribute("data-params")).toBe('{"accountSlug":"vyoh"}');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
