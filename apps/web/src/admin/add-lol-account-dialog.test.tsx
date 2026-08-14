import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddLolAccountDialog } from "./add-lol-account-dialog";

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn() }));

function renderDialog(disabled = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddLolAccountDialog disabled={disabled} />
    </QueryClientProvider>
  );
}

function fill(fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddLolAccountDialog", () => {
  it("posts the typed identity and defaults the region to euw1", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ gameName: "Agurin", tagLine: "EUW" }))
    );
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Add account/ }));

    fill({ Slug: "agurin", "Game name": "agurin", "Tag line": "euw" });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:2010/admin/lol-accounts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            slug: "agurin",
            gameName: "agurin",
            tagLine: "euw",
            region: "euw1",
            isOwner: false,
          }),
        })
      )
    );
  });

  it("offers every platform the api will accept", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Add account/ }));
    // Shared list, one source: a form offering a platform the api rejects is the
    // drift this replaced a hand-written copy to avoid.
    const options = screen.getByLabelText("Region").querySelectorAll("option");
    expect(options).toHaveLength(17);
    expect(options[0]?.getAttribute("value")).toBe("euw1");
  });

  it("shows the api's rejection against the form instead of a bare 400", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: "No Riot account found for nobody#ZZ9 on euw1." }),
        { status: 400 }
      )
    );
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Add account/ }));
    fill({ Slug: "nobody", "Game name": "nobody", "Tag line": "ZZ9" });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("No Riot account found for nobody#ZZ9 on euw1.");
    // Still open: the owner needs the form back to fix the typo.
    expect(screen.getByLabelText("Slug")).toBeTruthy();
  });

  it("closes and clears once the account is accepted", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ gameName: "Agurin", tagLine: "EUW" }))
    );
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Add account/ }));
    fill({ Slug: "agurin", "Game name": "agurin", "Tag line": "euw" });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));

    await waitFor(() => expect(screen.queryByLabelText("Slug")).toBeNull());
  });

  it("cannot be opened by a visitor who is not the owner", () => {
    renderDialog(true);
    expect(
      screen.getByRole("button", { name: /Add account/ }).hasAttribute("disabled")
    ).toBe(true);
  });
});
