// CSS Custom Highlight API (`CSS.highlights` + `::highlight()`, Baseline 2023)
// for tinting matched substrings in the ⌘K palette without wrapping every hit
// in a `<mark>`/`<span>`. Ranges are live JS objects, not DOM nodes, so a
// fast-typing user pays zero DOM churn per keystroke — the whole reason to
// prefer this over span-wrapping. See
// docs/working-notes/cross-cutting/css-platform-2026.md § C2.

const HIGHLIGHT_NAME = "palette-match";

// happy-dom (test env) and pre-2023 engines lack the API. Callers feature-gate
// through this so the palette degrades to plain (unhighlighted) rows.
export function supportsHighlightApi(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.highlights !== "undefined" &&
    typeof Highlight !== "undefined" &&
    typeof Range !== "undefined"
  );
}

// Rebuild the named highlight from every case-insensitive occurrence of
// `needle` inside the text of `[cmdk-item]` rows under `root`. Scoped to item
// rows so group headings ("Pages", "Recent") and the empty-state never tint.
// No DOM is mutated. Safe to call on every render / mutation.
export function paintMatchHighlights(root: HTMLElement, needle: string): void {
  if (!supportsHighlightApi()) return;
  const trimmed = needle.trim().toLowerCase();
  if (!trimmed) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    return;
  }

  const ranges: Range[] = [];
  for (const item of root.querySelectorAll<HTMLElement>("[cmdk-item]")) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue ?? "";
      const lower = text.toLowerCase();
      let from = lower.indexOf(trimmed);
      while (from !== -1) {
        const range = new Range();
        range.setStart(node, from);
        range.setEnd(node, from + trimmed.length);
        ranges.push(range);
        from = lower.indexOf(trimmed, from + trimmed.length);
      }
      node = walker.nextNode();
    }
  }

  if (ranges.length === 0) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    return;
  }
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
}

export function clearMatchHighlights(): void {
  if (!supportsHighlightApi()) return;
  CSS.highlights.delete(HIGHLIGHT_NAME);
}
