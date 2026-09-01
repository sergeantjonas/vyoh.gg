import { adminSteamGamesQueryKey } from "@/admin/use-admin-steam-games";
import { seedViewer } from "@/auth/mock-viewer";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { AdminSteamGame, SteamUpcomingItem } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { ReleaseCapsule } from "../upcoming/release-capsule";

const APPID = 4581550;

function hiddenRow(): AdminSteamGame {
  return {
    appid: APPID,
    name: "Something Private",
    hiddenAt: "2026-08-25T10:00:00.000Z",
    unfeaturedAt: null,
    reviewedAt: "2026-08-25T10:00:00.000Z",
    note: null,
    createdAt: "2026-08-25T10:00:00.000Z",
    recentPlaytimeMinutes: null,
  };
}

function item(): SteamUpcomingItem {
  return {
    appid: APPID,
    name: "Something Private",
    storeUrl: "https://store.steampowered.com/app/4581550",
    releaseDate: null,
    comingSoon: true,
    provenance: "wishlist",
  } as unknown as SteamUpcomingItem;
}

function renderCapsule({
  isOwner,
  entries,
}: { isOwner: boolean; entries: AdminSteamGame[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client, isOwner);
  client.setQueryData(adminSteamGamesQueryKey, { entries, pendingReview: 0 });
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <ReleaseCapsule item={item()} />
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}

describe("hidden marker on the release calendar", () => {
  // The gap this closes: the owner sees their hidden games on every surface, and
  // a capsule has no room for the toggle that would say so elsewhere.
  it("marks a hidden game for the owner", () => {
    renderCapsule({ isOwner: true, entries: [hiddenRow()] });
    expect(screen.getByText("Hidden")).toBeTruthy();
  });

  // The marker is a colour and a glyph, so the sentence has to reach the
  // accessible name or a screen-reader user learns nothing from it.
  it("says so in the accessible name, not only in the pill", () => {
    renderCapsule({ isOwner: true, entries: [hiddenRow()] });
    expect(screen.getByRole("link", { name: /hidden from visitors/i })).toBeTruthy();
  });

  // A visitor never sees a hidden game here at all — the api filters it — so a
  // marker would be describing something absent, and the shape of the marker
  // would itself be a tell if one ever leaked through.
  it("renders no marker for a visitor", () => {
    renderCapsule({ isOwner: false, entries: [hiddenRow()] });
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("renders no marker for a game the owner has not hidden", () => {
    renderCapsule({ isOwner: true, entries: [] });
    expect(screen.queryByText("Hidden")).toBeNull();
  });
});
