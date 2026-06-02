import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type {
  LolMomentChapterDescriptor,
  RecapChapterDescriptor,
  RecapChaptersResponse,
} from "@vyoh/shared";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock landing-config so useChapters() runs against deterministic curator
// values regardless of what the dev override is set to in the working tree.
// The applyDevLolMomentOverride/applyChapterPin/applyChapterOverrides specs
// below pass values directly, so they're unaffected by the mock.
vi.mock("@/home/landing-config", () => ({
  CHAPTER_COPY_OVERRIDES: {},
  PINNED_CHAPTER: null,
  DEV_LOL_MOMENT_OVERRIDE: [],
}));

import {
  applyChapterOverrides,
  applyChapterPin,
  applyDevLolMomentOverride,
  useChapters,
} from "./use-chapters";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function steamSubject(
  overrides: Partial<Extract<RecapChapterDescriptor, { kind: "steam-subject" }>> = {}
): Extract<RecapChapterDescriptor, { kind: "steam-subject" }> {
  return {
    kind: "steam-subject",
    slug: "steam-1",
    appid: 1,
    name: "Game 1",
    score: 100,
    daysSince: 0,
    ageBucket: "current",
    framing: null,
    ...overrides,
  };
}

describe("applyChapterOverrides", () => {
  it("returns the chapter untouched when no override matches", () => {
    const c = steamSubject();
    expect(applyChapterOverrides(c, {})).toBe(c);
  });

  it("merges eyebrow + title into the framing slot", () => {
    const c = steamSubject({ slug: "steam-42" });
    const result = applyChapterOverrides(c, {
      "steam-42": { eyebrow: "FEATURED", title: "Editor's pick" },
    });
    expect(result.framing).toEqual({
      eyebrow: "FEATURED",
      title: "Editor's pick",
    });
  });

  it("preserves prior framing fields when an override only specifies one slot", () => {
    const c = steamSubject({
      slug: "steam-42",
      framing: { eyebrow: "OLD", title: "Old title" },
    });
    const result = applyChapterOverrides(c, {
      "steam-42": { title: "New title" },
    });
    expect(result.framing).toEqual({ eyebrow: "OLD", title: "New title" });
  });
});

describe("applyDevLolMomentOverride", () => {
  const a = steamSubject({ slug: "steam-1", appid: 1 });
  const b = steamSubject({ slug: "steam-2", appid: 2 });
  const override: LolMomentChapterDescriptor = {
    kind: "lol-moment",
    slug: "lol-moment-off-meta-DEV",
    momentType: "OFF_META_PICK",
    score: 99,
    daysSince: 3,
    ageBucket: "current",
    matchId: "EUW_1",
    championAlias: "Renekton",
    matchStats: null,
    rankUp: null,
    kdaOutlier: null,
    hiatusReturn: null,
    streak: null,
    marathon: null,
    framing: null,
  };

  it("returns the input untouched when overrides is empty", () => {
    const list = [a, b];
    expect(applyDevLolMomentOverride(list, [])).toBe(list);
  });

  it("prepends a single override descriptor to the head of the list", () => {
    expect(applyDevLolMomentOverride([a, b], [override])).toEqual([override, a, b]);
  });

  it("prepends multiple overrides in declared order, ahead of the algorithmic list", () => {
    const second: LolMomentChapterDescriptor = {
      ...override,
      slug: "lol-moment-rank-up-DEV",
      momentType: "RANK_UP",
    };
    expect(applyDevLolMomentOverride([a, b], [override, second])).toEqual([
      override,
      second,
      a,
      b,
    ]);
  });

  it("drops a real descriptor whose slug collides with any override (override wins)", () => {
    const realMoment: RecapChapterDescriptor = {
      ...override,
      championAlias: "Jhin",
      matchId: "EUW_99",
    };
    const result = applyDevLolMomentOverride([realMoment, a], [override]);
    expect(result).toEqual([override, a]);
  });
});

describe("applyChapterPin", () => {
  const a = steamSubject({ slug: "steam-1", appid: 1 });
  const b = steamSubject({ slug: "steam-2", appid: 2 });
  const c = steamSubject({ slug: "steam-3", appid: 3 });

  it("returns the input untouched when pinnedSlug is null", () => {
    const list = [a, b, c];
    expect(applyChapterPin(list, null)).toBe(list);
  });

  it("moves the matched slug to the head", () => {
    expect(applyChapterPin([a, b, c], "steam-3")).toEqual([c, a, b]);
  });

  it("no-ops when the matched slug is already first", () => {
    const list = [a, b, c];
    expect(applyChapterPin(list, "steam-1")).toBe(list);
  });

  it("no-ops when the slug is missing — stale pin must not break the page", () => {
    const list = [a, b, c];
    expect(applyChapterPin(list, "steam-999")).toBe(list);
  });
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChapters", () => {
  it("fetches /recap/chapters and returns the selected list", async () => {
    const sample: RecapChaptersResponse = {
      chapters: [steamSubject({ slug: "steam-42", appid: 42 })],
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(sample), { status: 200 })
    );
    const { result } = renderHook(() => useChapters(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledWith("http://localhost:2010/recap/chapters");
    expect(result.current.data).toEqual(sample.chapters);
  });

  it("surfaces the api error message when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no signal" }), { status: 500 })
    );
    const { result } = renderHook(() => useChapters(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no signal");
  });
});
