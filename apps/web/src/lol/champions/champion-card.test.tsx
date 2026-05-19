import { fireEvent, render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "./champion-card";

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "26.9.1",
}));

describe("championCardClassName / championCardStyle", () => {
  it("base class includes themed-card markers", () => {
    expect(championCardClassName).toContain("themed-card");
    expect(championCardClassName).toContain("themed-card-interactive");
  });

  it("championCardStyle exposes a theme-color CSS variable", () => {
    const style = championCardStyle("Ahri") as Record<string, string>;
    expect(style["--theme-color"]).toBeTruthy();
    expect(style["--theme-color"]).toMatch(/^#/);
  });
});

describe("ChampionCardChrome", () => {
  function renderChrome(props: { champion: string; win?: boolean }) {
    return render(
      <MotionConfig reducedMotion="always">
        <ChampionCardChrome {...props} />
      </MotionConfig>
    );
  }

  it("renders the splash img pointed at the champion's card URL", () => {
    const { container } = renderChrome({ champion: "Ahri" });
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("/img/lol/champion/ahri/card/26.9.1.webp");
  });

  it("renders a win indicator (emerald-500) when win is true", () => {
    const { container } = renderChrome({ champion: "Ahri", win: true });
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  });

  it("renders a loss indicator (red-500) when win is false", () => {
    const { container } = renderChrome({ champion: "Ahri", win: false });
    expect(container.querySelector(".bg-red-500")).toBeTruthy();
  });

  it("does not render the win/loss bar when win is undefined", () => {
    const { container } = renderChrome({ champion: "Ahri" });
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
    expect(container.querySelector(".bg-red-500")).toBeNull();
  });

  it("transitions the splash to full opacity once the img fires onLoad", () => {
    const { container } = renderChrome({ champion: "Zed" });
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.className).toContain("opacity-0");
    fireEvent.load(img);
    expect(container.querySelector("img")?.className).toContain("opacity-95");
  });
});
