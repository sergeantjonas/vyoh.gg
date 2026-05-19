import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemIcon } from "./item-icon";

describe("ItemIcon", () => {
  it("renders the img with the provided iconUrl and alt", () => {
    const { container } = render(
      <ItemIcon iconUrl="/icon-100.png" alt="Mythic" className="size-6" />
    );
    const img = container.querySelector("img");
    expect(img?.src).toContain("/icon-100.png");
    expect(img?.alt).toBe("Mythic");
  });

  it("defaults alt to '' when none is provided", () => {
    const { container } = render(<ItemIcon iconUrl="/icon-200.png" />);
    expect(container.querySelector("img")?.alt).toBe("");
  });

  it("shows the loading shimmer before the img fires onLoad", () => {
    const { container } = render(<ItemIcon iconUrl="/icon-loadingflow.png" />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("removes the shimmer after the img onLoad event fires", () => {
    const { container } = render(<ItemIcon iconUrl="/icon-loaded.png" />);
    const img = container.querySelector("img");
    if (!img) throw new Error("expected an img");
    fireEvent.load(img);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("skips the shimmer entirely for an already-loaded URL on a subsequent mount", () => {
    const { container, unmount } = render(<ItemIcon iconUrl="/icon-cached.png" />);
    const img = container.querySelector("img");
    if (!img) throw new Error("expected an img");
    fireEvent.load(img);
    unmount();
    const second = render(<ItemIcon iconUrl="/icon-cached.png" />);
    expect(second.container.querySelector(".animate-pulse")).toBeNull();
  });
});
