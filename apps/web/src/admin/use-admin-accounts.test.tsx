import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { AdminLolAccount } from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminLolAccountsQueryKey,
  useAdminLolAccounts,
  useDeleteLolAccount,
  useUpdateLolAccount,
} from "./use-admin-accounts";

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const detail = (over: Partial<AdminLolAccount> = {}): AdminLolAccount => ({
  slug: "ahri",
  gameName: "Vyoh",
  tagLine: "Ahri",
  region: "euw1",
  isOwner: true,
  isPrimary: true,
  hiddenAt: null,
  syncPausedAt: null,
  createdAt: "2026-08-13T23:01:17.000Z",
  ...over,
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAdminLolAccounts", () => {
  it("sends the session cookie — the read is owner-gated", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([detail()])));
    const { result } = renderHook(() => useAdminLolAccounts(true), {
      wrapper: makeWrapper(freshClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/admin/lol-accounts",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
  });

  it("issues no request at all when the viewer isn't the owner", () => {
    // A signed-out visitor's request is known to fail before it is sent; firing
    // it anyway puts a red 401 in everyone's network panel on every visit.
    renderHook(() => useAdminLolAccounts(false), {
      wrapper: makeWrapper(freshClient()),
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("roster mutations", () => {
  it("patches only the flags it was given", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(detail())));
    const { result } = renderHook(() => useUpdateLolAccount(), {
      wrapper: makeWrapper(freshClient()),
    });

    result.current.mutate({ slug: "twix", patch: { hidden: true } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/admin/lol-accounts/twix",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ hidden: true }),
      })
    );
  });

  it("invalidates the nav's own query, not just the admin table", async () => {
    // Hiding an account changes the nav, and the nav is built from `/me` — a
    // write that refreshed only the admin table would leave the account it just
    // hid still listed in the dropdown.
    const client = freshClient();
    client.setQueryData(["me"], { lol: [], steam: [] });
    client.setQueryData(adminLolAccountsQueryKey, [detail()]);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(detail())));

    const { result } = renderHook(() => useUpdateLolAccount(), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate({ slug: "twix", patch: { syncPaused: true } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryState(["me"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(adminLolAccountsQueryKey)?.isInvalidated).toBe(true);
  });

  it("surfaces the api's refusal message verbatim", async () => {
    // The 409 body is the whole point of the delete refusal — it names how many
    // match rows would be stranded and what to do instead.
    const message = '"twix" still has 1153 match row(s).';
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 409, message }), { status: 409 })
    );
    const { result } = renderHook(() => useDeleteLolAccount(), {
      wrapper: makeWrapper(freshClient()),
    });

    result.current.mutate("twix");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(message);
  });

  it("rewrites a 401 into something the owner can act on", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Owner session required" }), { status: 401 })
    );
    const { result } = renderHook(() => useDeleteLolAccount(), {
      wrapper: makeWrapper(freshClient()),
    });

    result.current.mutate("twix");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Session expired — sign in again");
  });

  it("joins a validation error's field list into one line", async () => {
    // Nest sends `message` as an array when several DTO fields fail at once, and
    // the form has one place to put it.
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: ["slug must match pattern", "region must be one of"] }),
        { status: 400 }
      )
    );
    const { result } = renderHook(() => useDeleteLolAccount(), {
      wrapper: makeWrapper(freshClient()),
    });

    result.current.mutate("BadSlug");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe(
      "slug must match pattern. region must be one of"
    );
  });
});
