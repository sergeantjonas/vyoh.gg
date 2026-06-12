import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs from apps/api/ (this package); workspace root is two levels up.
const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

const REMAKE_SCAN_ROOTS = ["apps/web/src", "apps/api/src", "packages/shared/src"];

const TITLE_SCAN_ROOTS = ["apps/web/src"];

// excludeRemakes() itself is allowed to inline the filter — it *is* the helper.
const REMAKE_ALLOWLIST = new Set([
  path.join(WORKSPACE_ROOT, "packages/shared/src/lol/exclude-remakes.ts"),
]);

function walk(root: string, onFile: (abs: string) => void): void {
  for (const entry of readdirSync(root)) {
    const abs = path.join(root, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(abs, onFile);
    } else if (
      stat.isFile() &&
      /\.(ts|tsx)$/.test(entry) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(entry)
    ) {
      onFile(abs);
    }
  }
}

function collect(
  roots: string[],
  match: (text: string) => string[],
  allow: ReadonlySet<string> = new Set()
): string[] {
  const hits: string[] = [];
  for (const root of roots) {
    const abs = path.join(WORKSPACE_ROOT, root);
    walk(abs, (file) => {
      if (allow.has(file)) return;
      const text = readFileSync(file, "utf8");
      for (const snippet of match(text)) {
        hits.push(`${path.relative(WORKSPACE_ROOT, file)} — ${snippet}`);
      }
    });
  }
  return hits;
}

function matchLines(text: string, test: (line: string) => string | null): string[] {
  const out: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const note = test(line);
    if (note !== null) out.push(`L${i + 1}: ${line.trim()}${note}`);
  }
  return out;
}

describe("project conventions (structural lints)", () => {
  // repo-conventions.md: "Centralise domain invariants" — every LoL aggregation
  // must go through excludeRemakes() so the must-hold precondition can't be
  // silently dropped from a future call site.
  it("no inline `.filter(m => !m.remake)` outside the helper", () => {
    const regex = /\.filter\(\s*\(?[a-zA-Z_]\w*\)?\s*=>\s*!\s*[a-zA-Z_]\w*\.remake/;
    const hits = collect(
      REMAKE_SCAN_ROOTS,
      (text) => matchLines(text, (line) => (regex.test(line) ? "" : null)),
      REMAKE_ALLOWLIST
    );
    expect(hits, "Use excludeRemakes(matches) instead of inline remake filter").toEqual(
      []
    );
  });

  // repo-conventions.md: "Use TooltipPrimitive for all tooltip surfaces;
  // never use title=". Catches native HTML `title=` on intrinsic JSX tags;
  // capitalized component props (e.g. <CardShell title=...>) are allowed.
  it("no native `title=` on intrinsic JSX elements", () => {
    const hits = collect(TITLE_SCAN_ROOTS, (text) => {
      const regex = /<([a-z][a-zA-Z0-9-]*)\b[^<>]*?\stitle=/g;
      const out: string[] = [];
      let m: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop
      while ((m = regex.exec(text)) !== null) {
        const line = text.slice(0, m.index).split("\n").length;
        out.push(`L${line}: <${m[1]} … title=…> (use TooltipPrimitive instead)`);
      }
      return out;
    });
    expect(hits, "Wrap the trigger in TooltipPrimitive instead of using title=").toEqual(
      []
    );
  });

  // repo-conventions.md "Header primitives" + the ChapterLabel third recipe:
  // re-typing a blessed header recipe inline forks the primitive and drifts.
  // Token-based (not exact-string) so Tailwind class reordering can't dodge
  // the check; editorial variants with different tracking (0.18em, -wider)
  // are deliberately NOT flagged — they're a different role, not a re-type.
  it("no re-typed header recipes outside the blessed primitives", () => {
    const recipes = [
      {
        tokens: [
          /\bfont-semibold\b/,
          /\btext-sm\b/,
          /\buppercase\b/,
          /\btracking-\[0\.2em\]/,
        ],
        allow: "apps/web/src/components/ui/section-title.tsx",
        use: "SectionTitle",
      },
      {
        tokens: [
          /\bfont-medium\b/,
          /\btext-sm\b/,
          /\buppercase\b/,
          /\btracking-\[0\.2em\]/,
        ],
        allow: "apps/web/src/components/ui/card-title.tsx",
        use: "CardTitle",
      },
      {
        tokens: [
          /\btext-xs\b/,
          /\buppercase\b/,
          /\btracking-wide\b/,
          /\btext-muted-foreground\/70\b/,
        ],
        allow: "apps/web/src/components/ui/chapter-label.tsx",
        use: "ChapterLabel (or CHAPTER_LABEL_CLASS)",
      },
    ];
    const hits = recipes.flatMap((recipe) =>
      collect(
        TITLE_SCAN_ROOTS,
        (text) =>
          matchLines(text, (line) =>
            recipe.tokens.every((t) => t.test(line)) ? ` → use ${recipe.use}` : null
          ),
        new Set([path.join(WORKSPACE_ROOT, recipe.allow)])
      )
    );
    expect(hits, "Use the header primitive instead of re-typing its recipe").toEqual([]);
  });

  // repo-conventions.md "Tile background" rule 4: /20, /30, /70 are retired
  // rungs; bg-card/60 must pair with backdrop-blur (the frosted recipe). The
  // blur may legitimately sit in a cn() base string a few lines away from a
  // tone-branch bg-card/60 (match-review-view, champion matchup card), so the
  // /60 check scans a ±12-line window. Lines without a string delimiter are
  // prose comments, not class strings — skipped.
  it("no retired bg-card opacity rungs", () => {
    const hits = collect(TITLE_SCAN_ROOTS, (text) => {
      const lines = text.split("\n");
      const out: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!/["'`]/.test(line)) continue;
        if (/\bbg-card\/(20|30|70)\b/.test(line)) {
          out.push(`L${i + 1}: ${line.trim()} → use /50 (bare) or /60+blur (frosted)`);
          continue;
        }
        if (/\bbg-card\/60\b/.test(line)) {
          const window = lines.slice(Math.max(0, i - 12), i + 13).join("\n");
          if (!window.includes("backdrop-blur")) {
            out.push(`L${i + 1}: ${line.trim()} → bg-card/60 without backdrop-blur`);
          }
        }
      }
      return out;
    });
    expect(
      hits,
      "Retired tile opacity rung — see repo-conventions § tile background"
    ).toEqual([]);
  });
});
