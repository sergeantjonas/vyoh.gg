import { seedViewer } from "@/auth/mock-viewer";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CuratedGamesSection } from "./curated-games-section";

const LIST = {
  entries: [
    {
      appid: 1091500,
      name: "Cyberpunk 2077",
      hiddenAt: null,
      unfeaturedAt: "2026-08-21T03:50:00.000Z",
      reviewedAt: null,
      note: null,
      createdAt: "2026-08-21T03:50:00.000Z",
    },
  ],
  pendingReview: 1,
};

function renderSection(isOwner: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client, isOwner);
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <CuratedGamesSection />
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(LIST), { status: 200 })))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CuratedGamesSection", () => {
  // An enumeration of the hidden games is the secret the hiding exists to keep,
  // so this section is absent rather than locked — and it must not even ask.
  it("renders nothing for a visitor and issues no request", () => {
    const { container } = renderSection(false);
    expect(container.textContent).toBe("");
    const asked = vi
      .mocked(fetch)
      .mock.calls.some(([url]) => String(url).includes("/admin/steam-games"));
    expect(asked).toBe(false);
  });

  it("shows the overlay and the pending count to the owner", async () => {
    renderSection(true);
    await waitFor(() => expect(screen.getByText("Cyberpunk 2077")).toBeTruthy());
    expect(screen.getByText(/1 awaiting your ruling/i)).toBeTruthy();
  });
});
