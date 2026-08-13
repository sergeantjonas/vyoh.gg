import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Viewer } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./login-page";
import { OwnerBadge } from "./owner-badge";
import { viewerQueryKey } from "./use-viewer";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/status",
}));

// color-contrast needs real computed styles, which happy-dom does not produce.
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

const OWNER: Viewer = { isOwner: true, login: "sergeantjonas" };
const ANON: Viewer = { isOwner: false };

function wrap(ui: ReactNode, viewer?: Viewer) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (viewer) client.setQueryData(viewerQueryKey, viewer);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(ANON))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("points the login link at the api's own login route, carrying where to return", () => {
    wrap(<LoginPage next="/status" />, ANON);
    const link = screen.getByRole("link", { name: /Log in with GitHub/ });
    // The public origin, not the fetch origin: this ends up in markup, and the
    // internal origin is unreachable from a browser.
    expect(link.getAttribute("href")).toBe(
      "http://localhost:2010/auth/github/login?next=%2Fstatus"
    );
  });

  it("falls back to the current path when no next is given", () => {
    wrap(<LoginPage />, ANON);
    expect(
      screen.getByRole("link", { name: /Log in with GitHub/ }).getAttribute("href")
    ).toBe("http://localhost:2010/auth/github/login?next=%2Fstatus");
  });

  it("announces why a bounced attempt failed", () => {
    wrap(<LoginPage error="state" />, ANON);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/expired or didn't match/);
  });

  it("says nothing about which account was rejected", () => {
    wrap(<LoginPage error="forbidden" />, ANON);
    // Confirming "we know you, you're just not the owner" tells a stranger more
    // about the flow than they need.
    expect(screen.getByRole("alert").textContent).toBe(
      "That account can't sign in here."
    );
  });

  it("offers a way out instead of a login button once already signed in", () => {
    wrap(<LoginPage />, OWNER);
    expect(screen.queryByRole("link", { name: /Log in with GitHub/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeTruthy();
    expect(screen.getByText("@sergeantjonas")).toBeTruthy();
  });

  it("has no axe violations in either state", async () => {
    const anon = wrap(<LoginPage error="github" />, ANON);
    expect((await axe(anon.container)).violations).toEqual([]);
    anon.unmount();

    const owner = wrap(<LoginPage />, OWNER);
    expect((await axe(owner.container)).violations).toEqual([]);
  });
});

describe("OwnerBadge", () => {
  it("renders nothing for an anonymous visitor", () => {
    const { container } = wrap(<OwnerBadge />, ANON);
    expect(container.textContent).toBe("");
  });

  it("renders nothing while the viewer is still unknown", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { container } = wrap(<OwnerBadge />);
    expect(container.textContent).toBe("");
  });

  it("names the signed-in owner and offers a log out", () => {
    wrap(<OwnerBadge />, OWNER);
    expect(screen.getByText("@sergeantjonas")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Log out/ })).toBeTruthy();
  });

  it("disappears once log out lands", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    wrap(<OwnerBadge />, OWNER);

    fireEvent.click(screen.getByRole("button", { name: /Log out/ }));
    await waitFor(() => expect(screen.queryByText("@sergeantjonas")).toBeNull());
  });

  it("has no axe violations", async () => {
    const { container } = wrap(<OwnerBadge />, OWNER);
    expect((await axe(container)).violations).toEqual([]);
  });
});
