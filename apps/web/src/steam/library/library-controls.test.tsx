import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { LibraryControls } from "./library-controls";

vi.mock("./tag-filter-popover", () => ({
  TagFilterPopover: () => <div data-testid="tag-popover" />,
}));

type Props = ComponentProps<typeof LibraryControls>;

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    games: [] as SteamOwnedGame[],
    query: "",
    onQueryChange: () => {},
    sort: "lifetime",
    onSortChange: () => {},
    playedFilter: "all",
    onPlayedFilterChange: () => {},
    appTypeFilter: "game",
    onAppTypeFilterChange: () => {},
    selectedTagIds: [],
    onSelectedTagIdsChange: () => {},
    layout: "tiles",
    onLayoutChange: () => {},
    totalCount: 100,
    visibleCount: 100,
    ...overrides,
  };
}

describe("LibraryControls", () => {
  it("fires onQueryChange when the search input changes", () => {
    const onQueryChange = vi.fn();
    render(<LibraryControls {...baseProps({ onQueryChange })} />);
    fireEvent.change(screen.getByLabelText("Search library"), {
      target: { value: "portal" },
    });
    expect(onQueryChange).toHaveBeenCalledWith("portal");
  });

  it("renders the unsplit count label when visible == total", () => {
    render(<LibraryControls {...baseProps({ totalCount: 250, visibleCount: 250 })} />);
    expect(screen.getByText("250 games")).toBeTruthy();
  });

  it("renders the 'visible of total' label when a filter narrows the list", () => {
    render(<LibraryControls {...baseProps({ totalCount: 250, visibleCount: 80 })} />);
    expect(screen.getByText("80 of 250 games")).toBeTruthy();
  });

  it("uses the 'tool' noun when appTypeFilter is 'app'", () => {
    render(
      <LibraryControls
        {...baseProps({ appTypeFilter: "app", totalCount: 5, visibleCount: 5 })}
      />
    );
    expect(screen.getByText("5 tools")).toBeTruthy();
  });

  it("uses the singular noun when totalCount is 1", () => {
    render(<LibraryControls {...baseProps({ totalCount: 1, visibleCount: 1 })} />);
    expect(screen.getByText("1 game")).toBeTruthy();
  });

  it("renders both layout toggle buttons with the active one marked aria-pressed", () => {
    render(<LibraryControls {...baseProps({ layout: "rows" })} />);
    const rowsBtn = screen.getByLabelText("Row layout");
    const tilesBtn = screen.getByLabelText("Tile layout");
    expect(rowsBtn.getAttribute("aria-pressed")).toBe("true");
    expect(tilesBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("fires onLayoutChange when a layout button is clicked", () => {
    const onLayoutChange = vi.fn();
    render(<LibraryControls {...baseProps({ layout: "tiles", onLayoutChange })} />);
    fireEvent.click(screen.getByLabelText("Row layout"));
    expect(onLayoutChange).toHaveBeenCalledWith("rows");
  });
});
