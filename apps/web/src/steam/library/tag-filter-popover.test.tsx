import { useSteamTags } from "@/steam/use-tags";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagFilterPopover } from "./tag-filter-popover";

vi.mock("@/steam/use-tags", () => ({
  useSteamTags: vi.fn(),
}));

type TagCatalog = { tags: Array<{ id: number; name: string }> };

function mockTags(
  value: { data?: TagCatalog; isPending?: boolean; isError?: boolean } = {}
) {
  vi.mocked(useSteamTags).mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useSteamTags>);
}

function game(tagIds: number[]): SteamOwnedGame {
  return {
    appid: tagIds[0] ?? 1,
    name: `Game ${tagIds.join("_")}`,
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    tagIds,
  } as unknown as SteamOwnedGame;
}

afterEach(() => {
  vi.mocked(useSteamTags).mockReset();
});

describe("TagFilterPopover", () => {
  it("renders the trigger with no badge when no tags are selected", () => {
    mockTags({ data: { tags: [{ id: 1, name: "Action" }] } });
    render(<TagFilterPopover games={[]} selectedTagIds={[]} onChange={() => {}} />);
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it("renders the selected count badge when tags are selected", () => {
    mockTags({ data: { tags: [{ id: 1, name: "Action" }] } });
    render(
      <TagFilterPopover games={[]} selectedTagIds={[1, 2, 3]} onChange={() => {}} />
    );
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows the loading copy in the popover content when tags are pending", () => {
    mockTags({ isPending: true });
    render(<TagFilterPopover games={[]} selectedTagIds={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByText("Tags"));
    expect(screen.getByText("Loading tags…")).toBeTruthy();
  });

  it("shows the error copy when the catalog query errors", () => {
    mockTags({ isError: true });
    render(<TagFilterPopover games={[]} selectedTagIds={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByText("Tags"));
    expect(screen.getByText("Tag catalog unavailable.")).toBeTruthy();
  });

  it("renders tags that pass the frequency floor and toggles selection on click", () => {
    mockTags({
      data: {
        tags: [
          { id: 1, name: "Roguelike" },
          { id: 2, name: "Action" },
        ],
      },
    });
    // 4 games tagged Roguelike → exceeds floor; Action only appears once → hidden.
    const games = [game([1, 2]), game([1]), game([1]), game([1])];
    const onChange = vi.fn();
    render(<TagFilterPopover games={games} selectedTagIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Tags"));
    expect(screen.getByText("Roguelike")).toBeTruthy();
    expect(screen.queryByText("Action")).toBeNull();
    fireEvent.click(screen.getByText("Roguelike"));
    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it("fires onChange([]) when the clear button is clicked", () => {
    mockTags({ data: { tags: [] } });
    const onChange = vi.fn();
    render(<TagFilterPopover games={[]} selectedTagIds={[7]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Tags"));
    fireEvent.click(screen.getByLabelText("Clear tag selection"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
