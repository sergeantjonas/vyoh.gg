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
  // Scans whole file text, not line by line. The previous version tested each
  // line in isolation, so any call Biome wrapped across lines was invisible —
  // which is exactly how `pregame-signals.ts` kept an inline filter through
  // several sweeps. It also covered only `.filter`.
  //
  // This is a BACKSTOP, not a proof. It cannot see `if (m.remake) continue`
  // loop guards, block-bodied arrows, `m.remake === false`, destructured
  // params, or a helper that never spells the token. The post-game streak bug
  // fixed on 2026-07-25 was that last kind.
  it("no inline remake filter outside the helper", () => {
    const METHODS =
      "filter|find|findLast|findIndex|findLastIndex|some|every|reduce|reduceRight|flatMap";
    const hits = collect(
      REMAKE_SCAN_ROOTS,
      (text) => {
        // Built per file so the `g` flag's lastIndex cannot leak between files.
        const regex = new RegExp(
          String.raw`\.(?:${METHODS})\(\s*(?:\([^()]{0,80}\)|[A-Za-z_$][\w$]*)\s*=>[^;{}]{0,200}?!\s*[A-Za-z_$][\w$]*\.remake\b`,
          "g"
        );
        const out: string[] = [];
        let m: RegExpExecArray | null;
        // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop
        while ((m = regex.exec(text)) !== null) {
          const line = text.slice(0, m.index).split("\n").length;
          out.push(`L${line}: ${m[0].split("\n")[0]?.trim()}`);
        }
        return out;
      },
      REMAKE_ALLOWLIST
    );
    expect(hits, "Use excludeRemakes(matches) instead of inline remake filter").toEqual(
      []
    );
  });

  // Guards the guard. The `[^;{}]` gap is load-bearing: it spans newlines so a
  // wrapped call is still caught, but stops at a statement boundary so an
  // unrelated `.map()` earlier in a file cannot pair with a JSX display
  // conditional further down. Do not "simplify" it to `[\s\S]`.
  it("the remake lint flags wrapped aggregations without flagging display guards", () => {
    const METHODS =
      "filter|find|findLast|findIndex|findLastIndex|some|every|reduce|reduceRight|flatMap";
    const build = () =>
      new RegExp(
        String.raw`\.(?:${METHODS})\(\s*(?:\([^()]{0,80}\)|[A-Za-z_$][\w$]*)\s*=>[^;{}]{0,200}?!\s*[A-Za-z_$][\w$]*\.remake\b`,
        "g"
      );

    // Real shapes that regressed in the past — all must be caught.
    const mustFlag = [
      "const a = matches.filter((m) => !m.remake);",
      // The wrapped form that evaded the line-based lint.
      "const recent = matches.filter(\n  (m) => !m.remake && new Date(m.playedAt).getTime() >= cutoff\n);",
      "const last = ordered.find((m) => !m.remake);",
      "const any = matches.some((m) => !m.remake);",
    ];
    for (const src of mustFlag) {
      expect(build().test(src), `should flag: ${src}`).toBe(true);
    }

    // JSX display conditionals gate one row's badge; they are not aggregations.
    const mustNotFlag = [
      "{!match.remake && lpDelta !== undefined && <LpBadge delta={lpDelta} />}",
      "{accountSlug && summary.win && !summary.remake ? <A /> : <B />}",
      "{!summary.remake && lpDelta !== undefined && <LpBadge delta={lpDelta} />}",
      "if (m.remake) continue;",
      "const played = excludeRemakes(matches);",
      // A map early in a file must not pair with a display guard far below.
      "const names = matches.map((m) => m.champion);\nreturn <span>{!match.remake && 1}</span>;",
    ];
    for (const src of mustNotFlag) {
      expect(build().test(src), `should NOT flag: ${src}`).toBe(false);
    }
  });

  // The other half of the invariant, and the one the method-call lint above is
  // structurally blind to: a loop that guards with `continue` rather than
  // filtering. Ten of these survived the 2026-07-18 sweep because no regex
  // aimed at `.filter(...)` can see them.
  //
  // Scoped to `continue` deliberately. `if (summary.remake) return;` in
  // match-hero is a single-match display guard (it suppresses a result chime),
  // not an aggregation, and must not be flagged. Requiring `continue` excludes
  // it for free, and also excludes backfill-remake-flag.ts, which is the script
  // whose whole job is acting on the flag.
  const REMAKE_CONTINUE =
    /if\s*\([^;{}]{0,160}?\b[A-Za-z_$][\w$]*\.remake\b[^;{}]{0,160}?\)\s*continue\b/;

  it("no remake loop-guard outside the helper", () => {
    const hits = collect(
      REMAKE_SCAN_ROOTS,
      (text) => {
        const regex = new RegExp(REMAKE_CONTINUE.source, "g");
        const out: string[] = [];
        let m: RegExpExecArray | null;
        // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop
        while ((m = regex.exec(text)) !== null) {
          const line = text.slice(0, m.index).split("\n").length;
          out.push(`L${line}: ${m[0].split("\n")[0]?.trim()}`);
        }
        return out;
      },
      REMAKE_ALLOWLIST
    );
    expect(
      hits,
      "Iterate excludeRemakes(matches) instead of guarding with `if (m.remake) continue`"
    ).toEqual([]);
  });

  it("the remake loop-guard lint spares display guards and compound conditions", () => {
    const build = () => new RegExp(REMAKE_CONTINUE.source, "g");

    const mustFlag = [
      "for (const m of matches) {\n    if (m.remake) continue;\n",
      "if (match.remake) continue;",
      // The compound form from trend-death-matchup-heatmap.
      "if (m.remake || !m.laneOpponent || !m.hasTimeline) continue;",
      "if (!isRole(m.teamPosition) && m.remake) continue;",
    ];
    for (const src of mustFlag) {
      expect(build().test(src), `should flag: ${src}`).toBe(true);
    }

    const mustNotFlag = [
      // match-hero: suppresses a result chime for one match, not an aggregation.
      "if (summary.remake) return;",
      // backfill-remake-flag: the script that sets the flag.
      "if (summary.remake) {\n  updated += 1;\n}",
      "const played = excludeRemakes(matches);",
      "{!match.remake && lpDelta !== undefined && <LpBadge delta={lpDelta} />}",
      // A `continue` far below an unrelated remake read must not pair with it.
      "if (m.remake) return null;\nfor (const x of xs) {\n  if (!x) continue;\n}",
    ];
    for (const src of mustNotFlag) {
      expect(build().test(src), `should NOT flag: ${src}`).toBe(false);
    }
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
