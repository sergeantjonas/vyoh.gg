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

function collect(roots: string[], match: (text: string) => string[]): string[] {
  const hits: string[] = [];
  for (const root of roots) {
    const abs = path.join(WORKSPACE_ROOT, root);
    walk(abs, (file) => {
      if (REMAKE_ALLOWLIST.has(file)) return;
      const text = readFileSync(file, "utf8");
      for (const snippet of match(text)) {
        hits.push(`${path.relative(WORKSPACE_ROOT, file)} — ${snippet}`);
      }
    });
  }
  return hits;
}

describe("project conventions (structural lints)", () => {
  // repo-conventions.md: "Centralise domain invariants" — every LoL aggregation
  // must go through excludeRemakes() so the must-hold precondition can't be
  // silently dropped from a future call site.
  it("no inline `.filter(m => !m.remake)` outside the helper", () => {
    const hits = collect(REMAKE_SCAN_ROOTS, (text) => {
      const regex = /\.filter\(\s*\(?[a-zA-Z_]\w*\)?\s*=>\s*!\s*[a-zA-Z_]\w*\.remake/g;
      const out: string[] = [];
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (regex.test(line)) {
          out.push(`L${i + 1}: ${line.trim()}`);
          regex.lastIndex = 0;
        }
      }
      return out;
    });
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
});
