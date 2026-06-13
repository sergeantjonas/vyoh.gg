import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMatchHighlights,
  paintMatchHighlights,
  supportsHighlightApi,
} from "./highlight-matches";

// Minimal stand-in for the CSS Custom Highlight API, which happy-dom does not
// implement. Mirrors the maplike `CSS.highlights` registry and the `Highlight`
// constructor (`new Highlight(...ranges)`) the helper relies on.
class MockHighlight {
  ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

function stubHighlightApi() {
  const registry = new Map<string, MockHighlight>();
  vi.stubGlobal("CSS", { highlights: registry });
  vi.stubGlobal("Highlight", MockHighlight);
  return registry;
}

function rowList(...labels: string[]): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = labels.map((l) => `<div cmdk-item><span>${l}</span></div>`).join("");
  return root;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("supportsHighlightApi", () => {
  it("reports false in environments without the API (happy-dom)", () => {
    // No stubs: happy-dom lacks CSS.highlights / Highlight.
    expect(supportsHighlightApi()).toBe(false);
  });

  it("reports true once the API is present", () => {
    stubHighlightApi();
    expect(supportsHighlightApi()).toBe(true);
  });
});

describe("paintMatchHighlights (unsupported)", () => {
  it("is a no-op and does not throw when the API is missing", () => {
    const root = rowList("Jax", "Ahri");
    expect(() => paintMatchHighlights(root, "ja")).not.toThrow();
    expect(() => clearMatchHighlights()).not.toThrow();
  });
});

describe("paintMatchHighlights (supported)", () => {
  it("registers a range for every case-insensitive match across rows", () => {
    const registry = stubHighlightApi();
    const root = rowList("Jax", "Jarvan IV", "Ahri");

    paintMatchHighlights(root, "ja");

    const highlight = registry.get("palette-match");
    // Jax + Jarvan match "ja"; Ahri does not.
    expect(highlight?.ranges).toHaveLength(2);
  });

  it("recomputes ranges when the needle changes", () => {
    const registry = stubHighlightApi();
    const root = rowList("Jax", "Jarvan IV", "Ahri");

    paintMatchHighlights(root, "ja");
    expect(registry.get("palette-match")?.ranges).toHaveLength(2);

    // Narrowing to a needle only one row contains shrinks the highlight.
    paintMatchHighlights(root, "ahri");
    expect(registry.get("palette-match")?.ranges).toHaveLength(1);
  });

  it("clears the highlight on an empty needle", () => {
    const registry = stubHighlightApi();
    const root = rowList("Jax");

    paintMatchHighlights(root, "ja");
    expect(registry.has("palette-match")).toBe(true);

    paintMatchHighlights(root, "   ");
    expect(registry.has("palette-match")).toBe(false);
  });

  it("clears the highlight when nothing matches", () => {
    const registry = stubHighlightApi();
    const root = rowList("Jax", "Ahri");

    paintMatchHighlights(root, "ja");
    expect(registry.has("palette-match")).toBe(true);

    paintMatchHighlights(root, "zzz");
    expect(registry.has("palette-match")).toBe(false);
  });

  it("does not tint group headings, only [cmdk-item] rows", () => {
    const registry = stubHighlightApi();
    const root = document.createElement("div");
    root.innerHTML = `
      <div cmdk-group-heading>Pages</div>
      <div cmdk-item><span>Patches</span></div>`;

    // "pa" appears in both the heading and the row label; only the row counts.
    paintMatchHighlights(root, "pa");
    expect(registry.get("palette-match")?.ranges).toHaveLength(1);
  });
});
