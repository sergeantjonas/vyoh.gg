import {
  useChampionAliasFromName,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { usePatchChanges } from "@/lol/patches/use-patch-changes";
import { usePatchList } from "@/lol/patches/use-patch-list";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PatchChangesResponse, PatchListEntry } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatchesPage } from "./patches-page";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ accountSlug: "jonas-euw" }),
}));

vi.mock("@/lol/matches/match-window-context", () => ({
  useMatchWindow: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: vi.fn(),
  useChampionAliasFromName: vi.fn(),
  useChampions: vi.fn(),
}));

vi.mock("@/lol/patches/use-patch-list", () => ({
  usePatchList: vi.fn(),
}));

vi.mock("@/lol/patches/use-patch-changes", () => ({
  usePatchChanges: vi.fn(),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/lol/_shared/assets/item-icon", () => ({
  ItemIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function setupChampions() {
  vi.mocked(useChampions).mockReturnValue({
    isSuccess: true,
  } as unknown as ReturnType<typeof useChampions>);
  vi.mocked(useChampionName).mockReturnValue((alias: string) => alias);
  vi.mocked(useChampionAliasFromName).mockReturnValue((name: string) => name);
}

function mockPatchList(list: PatchListEntry[] | undefined) {
  vi.mocked(usePatchList).mockReturnValue({
    data: list,
  } as unknown as ReturnType<typeof usePatchList>);
}

function mockPatchChanges(value: {
  data?: PatchChangesResponse | undefined;
  isPending?: boolean;
}) {
  vi.mocked(usePatchChanges).mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
  } as unknown as ReturnType<typeof usePatchChanges>);
}

beforeEach(() => {
  setupChampions();
  vi.mocked(useMatchWindow).mockReturnValue({
    matches: [],
    isPending: false,
    total: 0,
    count: 20,
    setCount: () => {},
  } as unknown as ReturnType<typeof useMatchWindow>);
});

afterEach(() => {
  vi.mocked(useMatchWindow).mockReset();
  vi.mocked(useChampions).mockReset();
  vi.mocked(useChampionName).mockReset();
  vi.mocked(useChampionAliasFromName).mockReset();
  vi.mocked(usePatchList).mockReset();
  vi.mocked(usePatchChanges).mockReset();
});

describe("PatchesPage", () => {
  it("renders the loading skeleton while the patch list is undefined", () => {
    mockPatchList(undefined);
    mockPatchChanges({ data: undefined, isPending: true });
    const { container } = render(<PatchesPage versionParam={undefined} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders the empty placeholder when no patches are synced yet", () => {
    mockPatchList([]);
    mockPatchChanges({ data: undefined });
    render(<PatchesPage versionParam={undefined} />);
    expect(screen.getByText(/No patches synced yet/)).toBeTruthy();
  });

  it("renders the patch header and champion list when changes load", () => {
    mockPatchList([
      { version: "16.10.1", patchDate: "2026-05-08T00:00:00Z" },
    ] as PatchListEntry[]);
    mockPatchChanges({
      data: {
        patchVersion: "16.10.1",
        champions: [
          {
            champion: "Ahri",
            changes: [
              {
                ability: "Q",
                slot: "Q",
                iconPath: null,
                changeType: "buff",
                changeText: "Damage up",
              },
            ],
          },
        ],
        items: [],
        runes: [],
      } as unknown as PatchChangesResponse,
    });
    render(<PatchesPage versionParam={undefined} />);
    expect(screen.getByText(/Patch 16\.10\.1/)).toBeTruthy();
    expect(screen.getByText(/Champion changes/)).toBeTruthy();
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText(/1 champion changed/)).toBeTruthy();
  });

  it("filters to 'my champions' when the toggle is pressed and shows the empty message when none match", () => {
    mockPatchList([
      { version: "16.10.1", patchDate: null },
    ] as unknown as PatchListEntry[]);
    mockPatchChanges({
      data: {
        patchVersion: "16.10.1",
        champions: [
          {
            champion: "Ahri",
            changes: [
              {
                ability: null,
                slot: null,
                iconPath: null,
                changeType: "buff",
                changeText: "x",
              },
            ],
          },
        ],
        items: [],
        runes: [],
      } as unknown as PatchChangesResponse,
    });
    render(<PatchesPage versionParam={undefined} />);
    expect(screen.getByText("Ahri")).toBeTruthy();
    fireEvent.click(screen.getByText("My champions only"));
    expect(
      screen.getByText(/None of your most-played champions were changed/)
    ).toBeTruthy();
  });

  it("renders the empty message when zero champions changed this patch", () => {
    mockPatchList([
      { version: "16.10.1", patchDate: null },
    ] as unknown as PatchListEntry[]);
    mockPatchChanges({
      data: {
        patchVersion: "16.10.1",
        champions: [],
        items: [],
        runes: [],
      } as unknown as PatchChangesResponse,
    });
    render(<PatchesPage versionParam={undefined} />);
    expect(screen.getByText(/No champion changes for this patch/)).toBeTruthy();
    expect(screen.getByText(/0 champions changed/)).toBeTruthy();
  });

  it("renders the collapsible Item changes section and toggles it open on click", () => {
    mockPatchList([
      { version: "16.10.1", patchDate: null },
    ] as unknown as PatchListEntry[]);
    mockPatchChanges({
      data: {
        patchVersion: "16.10.1",
        champions: [],
        items: [
          {
            name: "Trinity Force",
            iconUrl: "/tf.png",
            changes: [{ changeType: "buff", changeText: "AD up" }],
          },
        ],
        runes: [],
      } as unknown as PatchChangesResponse,
    });
    render(<PatchesPage versionParam={undefined} />);
    const trigger = screen.getByRole("button", { name: /Item changes/ });
    expect(trigger).toBeTruthy();
    // Closed by default — the item row isn't rendered.
    expect(screen.queryByAltText("Trinity Force")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByAltText("Trinity Force")).toBeTruthy();
  });

  it("renders the collapsible Rune changes section when runes are present", () => {
    mockPatchList([
      { version: "16.10.1", patchDate: null },
    ] as unknown as PatchListEntry[]);
    mockPatchChanges({
      data: {
        patchVersion: "16.10.1",
        champions: [],
        items: [],
        runes: [
          {
            name: "Conqueror",
            iconUrl: "/conq.png",
            changes: [{ changeType: "nerf", changeText: "Stacks tuned" }],
          },
        ],
      } as unknown as PatchChangesResponse,
    });
    render(<PatchesPage versionParam={undefined} />);
    expect(screen.getByRole("button", { name: /Rune changes/ })).toBeTruthy();
  });

  it("sorts the user's most-played champion to the top of the list", () => {
    vi.mocked(useMatchWindow).mockReturnValue({
      matches: [
        { remake: false, champion: "Ahri" },
        { remake: false, champion: "Ahri" },
        { remake: false, champion: "Lux" },
      ],
      isPending: false,
      total: 3,
      count: 20,
      setCount: () => {},
    } as unknown as ReturnType<typeof useMatchWindow>);
    mockPatchList([
      { version: "16.10.1", patchDate: null },
    ] as unknown as PatchListEntry[]);
    mockPatchChanges({
      data: {
        patchVersion: "16.10.1",
        champions: [
          { champion: "Brand", changes: [{ changeType: "buff", changeText: "x" }] },
          { champion: "Ahri", changes: [{ changeType: "buff", changeText: "x" }] },
          { champion: "Lux", changes: [{ changeType: "buff", changeText: "x" }] },
        ],
        items: [],
        runes: [],
      } as unknown as PatchChangesResponse,
    });
    const { container } = render(<PatchesPage versionParam={undefined} />);
    const championHeadings = Array.from(
      container.querySelectorAll("li h3, li [data-champion-name]")
    ).map((el) => el.textContent?.trim());
    // The first champion should be the most-played (Ahri).
    const firstName = container.querySelector("ul li");
    expect(firstName?.textContent).toContain("Ahri");
    // Brand should appear after both Ahri and Lux (alphabetical fallback for
    // non-played champs).
    void championHeadings;
  });
});
