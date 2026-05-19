import { render } from "@testing-library/react";
import type { ChampionPatchChangeKind } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { ChangeKindGlyph } from "./change-kind-glyph";

const cases: Array<{
  kind: ChampionPatchChangeKind | null;
  glyph: string;
  colorFragment: string;
}> = [
  { kind: "buff", glyph: "↑", colorFragment: "emerald" },
  { kind: "nerf", glyph: "↓", colorFragment: "rose" },
  { kind: "new_effect", glyph: "+", colorFragment: "sky" },
  { kind: "removed", glyph: "×", colorFragment: "muted-foreground" },
  { kind: "adjustment", glyph: "·", colorFragment: "muted-foreground/60" },
  { kind: null, glyph: "·", colorFragment: "muted-foreground/60" },
];

describe("ChangeKindGlyph", () => {
  for (const { kind, glyph, colorFragment } of cases) {
    it(`renders '${glyph}' with ${colorFragment} color for kind=${kind}`, () => {
      const { container } = render(<ChangeKindGlyph kind={kind} />);
      const span = container.querySelector("span");
      expect(span?.textContent).toBe(glyph);
      expect(span?.className).toContain(colorFragment);
    });
  }
});
