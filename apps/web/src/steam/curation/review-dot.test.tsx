import { adminSteamReviewCountQueryKey } from "@/admin/use-admin-steam-games";
import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SteamReviewDot } from "./review-dot";

function renderDot({
  isOwner,
  pendingReview,
}: { isOwner: boolean; pendingReview: number | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client, isOwner);
  if (pendingReview !== null) {
    client.setQueryData(adminSteamReviewCountQueryKey, { pendingReview });
  }
  return render(
    <QueryClientProvider client={client}>
      <SteamReviewDot />
    </QueryClientProvider>
  );
}

describe("SteamReviewDot", () => {
  // A visitor cannot act on it and has no business knowing anything is pending.
  it("renders nothing for a visitor even when games are pending", () => {
    const { container } = renderDot({ isOwner: false, pendingReview: 3 });
    expect(container.textContent).toBe("");
  });

  it("renders nothing when the queue is empty", () => {
    const { container } = renderDot({ isOwner: true, pendingReview: 0 });
    expect(container.textContent).toBe("");
  });

  // The dot itself is colour-only, so the count has to reach a screen reader.
  it("names the pending count for assistive tech", () => {
    renderDot({ isOwner: true, pendingReview: 3 });
    expect(screen.getByText(/3 new games are waiting/i)).toBeTruthy();
  });

  it("says it in the singular for one game", () => {
    renderDot({ isOwner: true, pendingReview: 1 });
    expect(screen.getByText(/1 new game is waiting/i)).toBeTruthy();
  });
});
