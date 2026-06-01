import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ChapterCloser,
  ChapterDetail,
  ChapterOpener,
  ChapterStats,
} from "./chapter-bands";

describe("chapter band primitives", () => {
  it("ChapterOpener renders with data-band='opener'", () => {
    const { container } = render(
      <ChapterOpener>
        <h2>Your Ahri</h2>
      </ChapterOpener>
    );
    const band = container.querySelector("[data-band='opener']");
    expect(band).toBeTruthy();
    expect(band?.querySelector("h2")?.textContent).toBe("Your Ahri");
  });

  it("ChapterDetail renders with data-band='detail'", () => {
    const { container } = render(
      <ChapterDetail>
        <div>row</div>
      </ChapterDetail>
    );
    expect(container.querySelector("[data-band='detail']")).toBeTruthy();
  });

  it("ChapterStats renders with data-band='stats'", () => {
    const { container } = render(
      <ChapterStats>
        <span>57% WR</span>
      </ChapterStats>
    );
    expect(container.querySelector("[data-band='stats']")).toBeTruthy();
  });

  it("ChapterCloser renders with data-band='closer'", () => {
    const { container } = render(
      <ChapterCloser>
        <a href="/lol/me">deep link</a>
      </ChapterCloser>
    );
    expect(container.querySelector("[data-band='closer']")).toBeTruthy();
  });

  it("appends caller className alongside the slot defaults", () => {
    const { container } = render(
      <ChapterOpener className="my-custom-class">
        <span />
      </ChapterOpener>
    );
    const band = container.querySelector("[data-band='opener']");
    expect(band?.className).toContain("my-custom-class");
    // Default opener layout shouldn't be stripped by a caller className.
    expect(band?.className).toContain("flex-col");
  });
});
