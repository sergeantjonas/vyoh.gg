import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterShareButton } from "./chapter-share-button";

const axe = configureAxe({
  rules: {
    // Requires real computed styles; happy-dom doesn't paint.
    "color-contrast": { enabled: false },
  },
});

// Navigator share/clipboard surfaces vary per test; each test defines what it
// needs and this scrubs them so a stub can't leak into the next branch.
function scrubNavigator() {
  for (const key of ["share", "canShare", "clipboard"]) {
    Reflect.deleteProperty(navigator, key);
  }
}

function defineOnNavigator(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  scrubNavigator();
});

describe("ChapterShareButton", () => {
  it("shares the card PNG through the Web Share sheet when the browser can", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    defineOnNavigator("share", share);
    defineOnNavigator("canShare", vi.fn().mockReturnValue(true));

    render(<ChapterShareButton chapter="champion" title="Vyoh's Ahri" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0]?.[0] as {
      files: File[];
      title: string;
      text: string;
    };
    expect(payload.files[0]?.name).toBe("vyoh-recap-champion.png");
    expect(payload.files[0]?.type).toBe("image/png");
    expect(payload.title).toBe("Vyoh's Ahri");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("/og/recap/champion.png");
    expect(await screen.findByRole("button", { name: "Shared" })).toBeTruthy();
  });

  it("falls back to an image clipboard write when the share sheet is unavailable", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    defineOnNavigator("clipboard", { write });
    class MockClipboardItem {
      items: Record<string, unknown>;
      constructor(items: Record<string, unknown>) {
        this.items = items;
      }
    }
    vi.stubGlobal("ClipboardItem", MockClipboardItem);

    render(<ChapterShareButton chapter="conclusion" title="Vyoh's portrait" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const item = write.mock.calls[0]?.[0]?.[0] as MockClipboardItem;
    expect(Object.keys(item.items)).toEqual(["image/png"]);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("falls back to a download when neither share nor clipboard exists", async () => {
    // happy-dom ships a native navigator.clipboard — blank both channels
    // explicitly so the test exercises the last rung, not the second.
    defineOnNavigator("clipboard", undefined);
    vi.stubGlobal("ClipboardItem", undefined);
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ChapterShareButton chapter="champion" title="Vyoh's Ahri" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await screen.findByRole("button", { name: "Saved" });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("cascades to the clipboard when the share sheet fails for a non-cancel reason", async () => {
    defineOnNavigator(
      "share",
      vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    );
    defineOnNavigator("canShare", vi.fn().mockReturnValue(true));
    const write = vi.fn().mockResolvedValue(undefined);
    defineOnNavigator("clipboard", { write });
    class MockClipboardItem {
      items: Record<string, unknown>;
      constructor(items: Record<string, unknown>) {
        this.items = items;
      }
    }
    vi.stubGlobal("ClipboardItem", MockClipboardItem);

    render(<ChapterShareButton chapter="champion" title="Vyoh's Ahri" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("returns quietly to idle when the user dismisses the share sheet", async () => {
    defineOnNavigator(
      "share",
      vi.fn().mockRejectedValue(new DOMException("dismissed", "AbortError"))
    );
    defineOnNavigator("canShare", vi.fn().mockReturnValue(true));

    render(<ChapterShareButton chapter="champion" title="Vyoh's Ahri" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    // Never flips to a success verb — lands back on the idle label.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Share" })).toBeTruthy()
    );
    expect(screen.queryByRole("button", { name: "Shared" })).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ChapterShareButton chapter="champion" title="Vyoh's Ahri" />
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
