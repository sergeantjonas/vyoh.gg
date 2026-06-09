import { renderHook } from "@testing-library/react";
import { type RefObject, act, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssetPreload } from "./use-asset-preload";

vi.mock("@/lib/scroll-container", () => ({
  mainScrollRef: { current: null },
}));

type Observer = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  trigger: (entry: Partial<IntersectionObserverEntry>) => void;
};

const observers: Observer[] = [];
const createdImages: { src: string }[] = [];

class FakeIntersectionObserver implements Observer {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    observers.push(this);
  }
  trigger(entry: Partial<IntersectionObserverEntry>) {
    this.callback(
      [
        {
          isIntersecting: true,
          intersectionRatio: 1,
          ...entry,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    );
  }
}

class FakeImage {
  set src(value: string) {
    createdImages.push({ src: value });
  }
}

function renderHookWithRef(urls: ReadonlyArray<string | null | undefined>) {
  return renderHook(
    ({ urls }: { urls: ReadonlyArray<string | null | undefined> }) => {
      const ref = useRef<HTMLElement | null>(null);
      if (ref.current === null) {
        const el = document.createElement("section");
        Object.defineProperty(ref, "current", {
          value: el,
          writable: true,
          configurable: true,
        });
      }
      useAssetPreload(ref as RefObject<HTMLElement | null>, urls);
      return null;
    },
    { initialProps: { urls } }
  );
}

beforeEach(() => {
  observers.length = 0;
  createdImages.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("Image", FakeImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAssetPreload", () => {
  it("does not preload before the chapter ref intersects the rootMargin-expanded viewport", () => {
    renderHookWithRef(["https://test/a.jpg"]);
    expect(createdImages).toHaveLength(0);
  });

  it("preloads every resolved URL once the chapter enters the rootMargin window", () => {
    renderHookWithRef(["https://test/a.jpg", "https://test/b.jpg"]);
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true }));
    expect(createdImages.map((i) => i.src)).toEqual([
      "https://test/a.jpg",
      "https://test/b.jpg",
    ]);
  });

  it("uses rootMargin: 50% so the fetch starts ahead of the viewport", () => {
    renderHookWithRef(["https://test/a.jpg"]);
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    expect(io.options?.rootMargin).toBe("50%");
  });

  it("disconnects the observer after the first intersection — one-shot", () => {
    renderHookWithRef(["https://test/a.jpg"]);
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true }));
    expect(io.disconnect).toHaveBeenCalled();
  });

  it("filters out null/undefined URLs without binding an observer when the set is empty", () => {
    renderHookWithRef([null, undefined]);
    expect(observers).toHaveLength(0);
  });

  it("treats null URLs mixed with real URLs by preloading only the resolved ones", () => {
    renderHookWithRef([null, "https://test/a.jpg", undefined, "https://test/b.jpg"]);
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger({ isIntersecting: true }));
    expect(createdImages.map((i) => i.src)).toEqual([
      "https://test/a.jpg",
      "https://test/b.jpg",
    ]);
  });

  it("preloads immediately when IntersectionObserver is undefined (SSR / no-IO fallback)", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.stubGlobal("Image", FakeImage);
    renderHookWithRef(["https://test/a.jpg", "https://test/b.jpg"]);
    expect(createdImages.map((i) => i.src)).toEqual([
      "https://test/a.jpg",
      "https://test/b.jpg",
    ]);
  });
});
