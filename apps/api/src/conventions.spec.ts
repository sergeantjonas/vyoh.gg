import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest runs from apps/api/ (this package); workspace root is two levels up.
const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

const REMAKE_SCAN_ROOTS = ["apps/web/src", "apps/api/src", "packages/shared/src"];

const TITLE_SCAN_ROOTS = ["apps/web/src"];

const TIMEZONE_SCAN_ROOTS = ["apps/web/src"];

// Date/time fields that mark a `.toLocaleString` options object as formatting a
// date rather than a number. `.toLocaleString` is the overloaded one: it is
// mostly `count.toLocaleString("en-GB")` in this repo, and a lint that flagged
// those would be turned off rather than obeyed.
const DATE_FIELDS =
  /\b(?:dateStyle|timeStyle|weekday|era|year|month|day|hour|minute|second|dayPeriod|timeZoneName)\s*:/;

/**
 * Every `Intl.DateTimeFormat` / `toLocale*String` call in `text` that renders a
 * date without naming a zone. Scans by matching parens rather than by regex so
 * a nested or multi-line options object is read as one call.
 */
function unpinnedFormatters(text: string): Array<{ line: number; snippet: string }> {
  const CALL = /\b(?:new Intl\.DateTimeFormat|\.toLocale(?:Date|Time)?String)\s*\(/g;
  const out: Array<{ line: number; snippet: string }> = [];
  for (const m of text.matchAll(CALL)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let args = "";
    for (let i = open; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) {
          args = text.slice(open + 1, i);
          break;
        }
      }
    }
    if (/\btimeZone\s*:/.test(args)) continue;
    // `.toLocaleString` only counts when its options say it means a date.
    const ambiguous = m[0].startsWith(".toLocaleString");
    if (ambiguous && !DATE_FIELDS.test(args)) continue;
    out.push({
      line: text.slice(0, m.index).split("\n").length,
      snippet: m[0].slice(0, -1).trim(),
    });
  }
  return out;
}

// excludeRemakes() itself is allowed to inline the filter — it *is* the helper.
const REMAKE_ALLOWLIST = new Set([
  path.join(WORKSPACE_ROOT, "packages/shared/src/lol/exclude-remakes.ts"),
]);

const CURATION_SCAN_ROOTS = ["apps/web/src", "apps/api/src", "packages/shared/src"];

// Same reasoning: curation.ts defines the helpers, so it is the one file that
// has to touch the Sets.
const CURATION_ALLOWLIST = new Set([
  path.join(WORKSPACE_ROOT, "packages/shared/src/steam/curation.ts"),
]);

const VIEWER_SCAN_ROOTS = ["apps/api/src"];

/**
 * Routes taking `@ViewerIsOwner()` without `@WithViewer()` above them.
 *
 * Walks back from each param decorator to the route decorator that opens its
 * handler, so the check sees that handler's own stack. A whole-file
 * `text.includes("@WithViewer()")` would be satisfied by any neighbouring
 * route, which is precisely the defect shape.
 */
function unpairedViewerParams(text: string): string[] {
  const ROUTE_DECORATORS = ["@Get(", "@Post(", "@Patch(", "@Put(", "@Delete("];
  const out: string[] = [];
  const regex = /@ViewerIsOwner\(/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop
  while ((m = regex.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    const routeAt = Math.max(...ROUTE_DECORATORS.map((d) => before.lastIndexOf(d)));
    if (routeAt === -1) continue;
    if (before.slice(routeAt).includes("@WithViewer()")) continue;
    const line = before.split("\n").length;
    out.push(`L${line}: ${before.slice(routeAt).split("\n")[0]?.trim()}`);
  }
  return out;
}

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

// Body of one class method, from its declaration to the next sibling at the
// same indent. Scoping matters for the allowlist lint below: a plain
// `text.includes()` would be satisfied by the guard living in a neighbouring
// method, which is the exact shape of the defect that lint exists to catch.
function methodBody(text: string, name: string): string | null {
  const start = text.indexOf(`async ${name}(`);
  if (start === -1) return null;
  const rest = text.slice(start);
  const next = rest.slice(1).search(/\n {2}(?:async |private |public |\/\*\*|\/\/ )/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

// Every owner-only route in the api, keyed by the file that declares it. Each
// entry is the route decorator verbatim, minus the `@`, so a renamed route or a
// verb changed under it surfaces as a failing lint rather than a silently
// unguarded endpoint.
const GUARDED_ROUTES: Record<string, string[]> = {
  "apps/api/src/status/status.controller.ts": [
    'Post("sync")',
    'Post("sync/pause")',
    'Post("sync/resume")',
    'Post("sync/patches")',
  ],
  // The duo LP split is the owner's own ladder movement, not the public duo list.
  "apps/api/src/lol/lol.controller.ts": ['Post("matches/sync")', 'Get("duos/lp")'],
  "apps/api/src/steam/game-refresh.controller.ts": ['Post("game/:appid/refresh")'],
  // The admin reads are gated too, unlike every other read in the api: they
  // carry `hiddenAt`/`syncPausedAt`, which `/me` deliberately withholds.
  "apps/api/src/admin/admin-accounts.controller.ts": [
    'Get("lol-accounts")',
    'Post("lol-accounts")',
    'Patch("lol-accounts/:slug")',
    'Delete("lol-accounts/:slug")',
    'Get("lol-accounts/:slug/purge-preview")',
    'Post("lol-accounts/:slug/purge")',
  ],
  // Gated harder than the roster, and for a sharper reason: an enumeration of
  // the games the owner hid is precisely the secret the hiding exists to keep,
  // so an ungated read here doesn't merely leak ops detail — it defeats the
  // feature outright while every public surface keeps filtering correctly.
  "apps/api/src/admin/admin-steam-games.controller.ts": [
    "Get()",
    'Get("review-count")',
    'Patch(":appid")',
    'Delete(":appid")',
  ],
};

// Anything that makes a controller depend on `AuthService` at bootstrap: both
// guards inject it, and `WithViewer()` bundles `ViewerGuard`.
const AUTH_GUARD_REF = /\b(?:OwnerGuard|ViewerGuard|WithViewer)\b/;

/**
 * Identifiers listed in a `name: [ … ]` field of a `@Module({ … })` decorator.
 * Returns null when the field is absent, so "no `imports` at all" stays
 * distinguishable from "an `imports` array that omits AuthModule".
 *
 * Brace-matched rather than regex: `providers` holds `{ provide, useFactory }`
 * objects whose own commas would end the array early. Non-identifier fragments
 * from those objects are dropped, which is why only bare class names survive.
 */
function moduleField(text: string, name: string): string[] | null {
  const m = new RegExp(`\\b${name}\\s*:\\s*\\[`).exec(text);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) {
        return text
          .slice(open + 1, i)
          .replace(/\/\/[^\n]*/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[A-Z][\w$]*$/.test(s));
      }
    }
  }
  return null;
}

/** The module-relative import specifier a symbol is imported from, if any. */
function importPathFor(text: string, symbol: string): string | null {
  const re = new RegExp(`import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`);
  return re.exec(text)?.[1] ?? null;
}

/**
 * Modules that declare a controller using an auth guard without importing
 * `AuthModule`, as `module — controller` strings.
 */
function guardedModulesMissingAuth(moduleFiles: readonly string[]): string[] {
  const out: string[] = [];
  for (const abs of moduleFiles) {
    const text = readFileSync(abs, "utf8");
    // AuthModule itself provides the guards, so it needs no self-import.
    if ((moduleField(text, "providers") ?? []).includes("AuthService")) continue;
    const imports = moduleField(text, "imports") ?? [];
    if (imports.includes("AuthModule")) continue;
    for (const controller of moduleField(text, "controllers") ?? []) {
      const rel = importPathFor(text, controller);
      if (rel === null || !rel.startsWith(".")) continue;
      let src: string;
      try {
        src = readFileSync(path.resolve(path.dirname(abs), `${rel}.ts`), "utf8");
      } catch {
        continue;
      }
      if (!AUTH_GUARD_REF.test(src)) continue;
      out.push(`${path.relative(WORKSPACE_ROOT, abs)} — ${controller}`);
    }
  }
  return out;
}

// The decorator lines attached to one route decorator, walking down to the
// method signature. Scoped rather than a whole-file `includes()` for the same
// reason `methodBody` is: a guard on a neighbouring route would satisfy the
// loose version, and that is exactly the regression being linted for.
function decoratorsFor(text: string, route: string): string[] {
  const start = text.indexOf(`@${route}`);
  if (start === -1) return [];
  const out: string[] = [];
  for (const raw of text.slice(start).split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("@")) break;
    out.push(line);
  }
  return out;
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

  // The Steam half of the same convention, and a stronger form of it: the
  // remake invariant needed two lints because `.remake` is a legitimate field
  // read in display code, so only the *aggregation* shapes could be banned.
  // A curation set has no such second use — every legitimate read goes through
  // `isHiddenGame()`, `excludeHiddenGames()`, `excludeUnfeaturedGames()` or
  // `visibleAppidFilter()` — so reaching into `.hidden.has(...)` directly is
  // bannable outright, which covers `.filter(...)` and `if (…) continue` alike.
  //
  // Same backstop caveat as the remake lints: this cannot see an aggregation
  // that forgot to filter at all. If you cannot point at the exclude call, the
  // aggregation is wrong whether or not this lint is quiet.
  it("no raw curation-set access outside the shared helper", () => {
    const hits = collect(
      CURATION_SCAN_ROOTS,
      (text) =>
        matchLines(text, (line) =>
          /\.(?:hidden|unfeatured)\.has\(/.test(line) ? "" : null
        ),
      CURATION_ALLOWLIST
    );
    expect(
      hits,
      "Use excludeHiddenGames / excludeUnfeaturedGames / isHiddenGame from @vyoh/shared instead of reading the curation Set directly"
    ).toEqual([]);
  });

  it("the curation lint catches both the filter and the loop-guard shape", () => {
    const flags = (src: string) => /\.(?:hidden|unfeatured)\.has\(/.test(src);

    const mustFlag = [
      "const visible = games.filter((g) => !curation.hidden.has(g.appid));",
      "for (const g of games) {\n  if (curation.hidden.has(g.appid)) continue;",
      "if (sets.unfeatured.has(appid)) continue;",
      "const n = games.reduce((acc, g) => (curation.hidden.has(g.appid) ? acc : acc + 1), 0);",
    ];
    for (const src of mustFlag) {
      expect(flags(src), `should flag: ${src}`).toBe(true);
    }

    const mustNotFlag = [
      "const visible = excludeHiddenGames(games, curation);",
      "for (const g of excludeUnfeaturedGames(games, curation)) {",
      // The single-appid predicate is the blessed way to ask about one game.
      "if (isHiddenGame(appid, curation)) throw new NotFoundException();",
      "where: { appid: visibleAppidFilter(curation) },",
      "const hidden = new Set<number>();",
    ];
    for (const src of mustNotFlag) {
      expect(flags(src), `should NOT flag: ${src}`).toBe(false);
    }
  });

  // `@ViewerIsOwner()` answers `false` when the guard never ran, which is the
  // safe direction — a route that forgets `@WithViewer()` serves the public
  // projection to the owner rather than the owner's to a visitor. Safe is not
  // the same as correct: the owner would watch their own hidden games vanish
  // from one surface with nothing to explain it, and the handler still
  // type-checks. So the pairing is structural.
  it("every route reading the viewer declares @WithViewer()", () => {
    const hits = collect(VIEWER_SCAN_ROOTS, unpairedViewerParams);
    expect(
      hits,
      "@ViewerIsOwner() without @WithViewer() on the same route always resolves to the public projection"
    ).toEqual([]);
  });

  it("the @WithViewer lint reads the annotated route's own decorators", () => {
    const paired = `
  @Get("wishlist")
  @WithViewer()
  async getWishlist(@ViewerIsOwner() isOwner: boolean) {}
`;
    expect(unpairedViewerParams(paired)).toEqual([]);

    const missing = `
  @Get("wishlist")
  async getWishlist(@ViewerIsOwner() isOwner: boolean) {}
`;
    expect(unpairedViewerParams(missing)).toHaveLength(1);

    // The defect shape the scoping exists for: a neighbour carries the
    // decorator, so a whole-file `includes()` would call this clean.
    const neighbour = `
  @Get("upcoming")
  @WithViewer()
  async getUpcoming(@ViewerIsOwner() isOwner: boolean) {}

  @Get("wishlist")
  async getWishlist(@ViewerIsOwner() isOwner: boolean) {}
`;
    expect(unpairedViewerParams(neighbour)).toHaveLength(1);
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

  // The api origin belongs to `lib/api-url.ts` and nowhere else. 65 files had
  // re-declared it before the 2026-07-26 consolidation, which is what made the
  // hosting fix a chunked task instead of a one-line edit — and under SSR a
  // stray copy is worse than duplication, because a loader running in Node
  // needs a different origin than the markup it produces.
  //
  // Comment lines are skipped so prose can still name the dev origin (the
  // fetch-stub rationale in `test-setup.ts` does). This is a BACKSTOP: it
  // catches a re-declared literal, not the subtler error of reaching for
  // API_URL where a rendered URL needs API_PUBLIC_URL.
  const HARDCODED_ORIGIN = /["'`]https?:\/\/localhost:\d+/;
  const API_URL_ALLOWLIST = new Set([
    path.join(WORKSPACE_ROOT, "apps/web/src/lib/api-url.ts"),
  ]);

  const scanForHardcodedOrigin = (text: string): string[] =>
    matchLines(text, (line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return null;
      return HARDCODED_ORIGIN.test(line) ? " → import from @/lib/api-url" : null;
    });

  it("no hardcoded api origin outside lib/api-url.ts", () => {
    const hits = collect(TITLE_SCAN_ROOTS, scanForHardcodedOrigin, API_URL_ALLOWLIST);
    expect(
      hits,
      "Import API_URL (fetch) or API_PUBLIC_URL (rendered) from @/lib/api-url"
    ).toEqual([]);
  });

  it("the api-origin lint reads code but not prose", () => {
    const mustFlag = [
      'const API_URL = "http://localhost:2010";',
      'await fetch("http://localhost:2010/steam/tags");',
      "const url = `http://localhost:2010/og/home.png`;",
      "new EventSource('http://localhost:2010/status/stream')",
    ];
    for (const src of mustFlag) {
      expect(scanForHardcodedOrigin(src).length, `should flag: ${src}`).toBe(1);
    }

    const mustNotFlag = [
      // test-setup.ts names the origin while explaining the fetch stub.
      "// components were hitting `http://localhost:2010` for real",
      " * the api dev server at http://localhost:2010",
      // Paths composed onto the helper are the whole point.
      "await fetch(`${API_URL}/steam/tags`);",
      "return `${API_PUBLIC_URL}/img/lol/map/${mapId}.webp`;",
      // A different host that happens to be absolute is not this invariant.
      'const DDRAGON = "https://ddragon.leagueoflegends.com";',
    ];
    for (const src of mustNotFlag) {
      expect(scanForHardcodedOrigin(src).length, `should NOT flag: ${src}`).toBe(0);
    }
  });

  // repo-conventions.md: "Centralise domain invariants" — the same rule the
  // remake lint above enforces, applied to the owner allowlist.
  //
  // `resolveSummoner` is the only path to Riot's Account-V1 and the only writer
  // of a `Summoner` row, so it is where the allowlist has to hold. Enforcing it
  // at each caller instead is what produced the defect this lint exists for: 27
  // call sites checked, 3 did not, and the two services responsible never
  // injected IdentityService at all — so an anonymous request could name any
  // Riot ID and have it resolved upstream and persisted.
  //
  // Deliberately narrow. It pins one guard in one method rather than trying to
  // infer which methods "should" be gated, because the general version is the
  // kind of fuzzy rule that gets disabled the first time it misfires.
  it("resolveSummoner enforces the owner allowlist", () => {
    const text = readFileSync(
      path.join(WORKSPACE_ROOT, "apps/api/src/lol/lol.service.ts"),
      "utf8"
    );
    const body = methodBody(text, "resolveSummoner");
    expect(body, "resolveSummoner not found in lol.service.ts").not.toBeNull();
    expect(
      body?.includes("isLolAccountAllowed"),
      "resolveSummoner must call isLolAccountAllowed before reaching Riot or writing a Summoner row"
    ).toBe(true);
  });

  it("the allowlist lint reads the right method body", () => {
    const guarded = [
      "  async resolveSummoner(a: string): Promise<void> {\n    if (!this.identity.isLolAccountAllowed(a)) throw new ForbiddenException();\n  }\n",
    ];
    for (const src of guarded) {
      expect(methodBody(src, "resolveSummoner")?.includes("isLolAccountAllowed")).toBe(
        true
      );
    }

    // The guard sitting in a *neighbouring* method must not count — that is
    // precisely the shape of the bug (checked at the caller, not the choke
    // point), so a lint that accepted it would pass against the defect.
    const unguarded =
      "  async other(): Promise<void> {\n    this.identity.isLolAccountAllowed(x);\n  }\n\n  async resolveSummoner(a: string): Promise<void> {\n    return this.prisma.summoner.upsert(a);\n  }\n";
    expect(
      methodBody(unguarded, "resolveSummoner")?.includes("isLolAccountAllowed")
    ).toBe(false);

    expect(methodBody("class X {}", "resolveSummoner")).toBeNull();
  });

  // owner-auth.md: `OwnerGuard` is applied per route, which is the right shape
  // (a public-by-design site should read every gate as a deliberate exception)
  // but leaves nothing structural stopping a decorator from being dropped in a
  // refactor. These are every owner-only route in the api, and an ungated one
  // means an anonymous visitor can burn the dev-tier Riot budget, pause syncs,
  // or rewrite the roster. A missing decorator is invisible in review and silent
  // at runtime — the route just works, for everyone.
  //
  // Named routes, not a "every @Post is guarded" rule: `/auth/logout` is a POST
  // that must stay open, so the general version would need an allowlist and the
  // allowlist would grow. The admin module is also why the rule can't key off
  // the verb at all — two of its gated routes are `@Get`.
  it("every owner-only route carries OwnerGuard", () => {
    for (const [file, routes] of Object.entries(GUARDED_ROUTES)) {
      const text = readFileSync(path.join(WORKSPACE_ROOT, file), "utf8");
      for (const route of routes) {
        expect(
          decoratorsFor(text, route),
          `${file} — @${route} must be decorated with @UseGuards(OwnerGuard)`
        ).toContain("@UseGuards(OwnerGuard)");
      }
    }
  });

  it("the guard lint reads decorators on the annotated route only", () => {
    const guarded = '  @Post("sync")\n  @UseGuards(OwnerGuard)\n  triggerSync() {}\n';
    expect(decoratorsFor(guarded, 'Post("sync")')).toContain("@UseGuards(OwnerGuard)");

    // Order-independent: `@HttpCode` sits between the two on lol.controller.
    const interleaved =
      '  @Post("matches/sync")\n  @UseGuards(OwnerGuard)\n  @HttpCode(200)\n  async syncMatches() {}\n';
    expect(decoratorsFor(interleaved, 'Post("matches/sync")')).toContain(
      "@UseGuards(OwnerGuard)"
    );

    // A guard on the *neighbouring* route must not count — that is the shape of
    // the regression, so a lint that accepted it would pass against the defect.
    const misplaced =
      '  @Post("other")\n  @UseGuards(OwnerGuard)\n  other() {}\n\n  @Post("sync")\n  triggerSync() {}\n';
    expect(decoratorsFor(misplaced, 'Post("sync")')).not.toContain(
      "@UseGuards(OwnerGuard)"
    );

    // The verb is part of the key: swapping `@Delete` for `@Post` under the same
    // path is a different route, and the lint must not accept the substitution.
    const wrongVerb =
      '  @Post("lol-accounts/:slug")\n  @UseGuards(OwnerGuard)\n  x() {}\n';
    expect(decoratorsFor(wrongVerb, 'Delete("lol-accounts/:slug")')).toEqual([]);

    // A renamed or deleted route fails loudly rather than vacuously passing.
    expect(decoratorsFor("class X {}", 'Post("sync")')).toEqual([]);
  });

  // Nest resolves a guard's own dependencies from the module that declares the
  // *controller*, not from the module that defined the guard. So a controller
  // reaching for OwnerGuard/ViewerGuard whose module omits `imports: [AuthModule]`
  // throws UnknownDependenciesException at bootstrap — the whole api fails to
  // start, not just that route.
  //
  // What makes this worth a lint is that the controller spec cannot catch it: a
  // Nest testing module lists its own providers, so hand-providing AuthService
  // there makes the spec pass against a module wiring that cannot boot. That is
  // exactly how SteamModule shipped without the import — four sibling modules
  // already had it, each with a comment explaining why.
  it("every module declaring a guarded controller imports AuthModule", () => {
    const moduleFiles: string[] = [];
    walk(path.join(WORKSPACE_ROOT, "apps/api/src"), (abs) => {
      if (abs.endsWith(".module.ts")) moduleFiles.push(abs);
    });
    // Guards the guard: a vacuous pass if the walk ever stops finding modules.
    expect(moduleFiles.length).toBeGreaterThan(5);
    expect(
      guardedModulesMissingAuth(moduleFiles),
      "add `imports: [AuthModule]` — the guard's AuthService resolves from the controller's module"
    ).toEqual([]);
  });

  // The parsing is where the subtlety lives, so the fixtures exercise the two
  // helpers directly rather than mocking a filesystem around them.
  it("the AuthModule lint reads the declaring module's own imports", () => {
    const missing = `
      import { AuthModule } from "../auth/auth.module";
      @Module({ imports: [RiotModule], controllers: [SteamController] })
      export class SteamModule {}`;
    expect(moduleField(missing, "imports")).toEqual(["RiotModule"]);
    expect(moduleField(missing, "controllers")).toEqual(["SteamController"]);

    // An *imported but unlisted* AuthModule is the real defect shape: the import
    // statement is present, so a naive `text.includes("AuthModule")` passes.
    expect(moduleField(missing, "imports")).not.toContain("AuthModule");

    // A module with no `imports` key at all — SteamModule's actual state.
    const noImports = "@Module({ controllers: [SteamController] })";
    expect(moduleField(noImports, "imports")).toBeNull();
    expect(moduleField(noImports, "controllers")).toEqual(["SteamController"]);

    // `providers` must survive the object-literal commas inside it.
    const withFactory = `@Module({
      providers: [AuthService, OwnerGuard, { provide: AUTH_CONFIG, useFactory: () => resolveAuthConfig(process.env, origin) }],
    })`;
    expect(moduleField(withFactory, "providers")).toEqual(["AuthService", "OwnerGuard"]);

    // A commented-out entry must not count as present.
    const commented = "@Module({ imports: [\n  // AuthModule,\n  RiotModule,\n] })";
    expect(moduleField(commented, "imports")).toEqual(["RiotModule"]);

    // Import-path resolution, including the multi-symbol and aliased forms.
    expect(
      importPathFor(
        'import { SteamController } from "./steam.controller";',
        "SteamController"
      )
    ).toBe("./steam.controller");
    expect(
      importPathFor(
        'import { A, SteamController, B } from "./steam.controller";',
        "SteamController"
      )
    ).toBe("./steam.controller");
    expect(
      importPathFor('import { Other } from "./other";', "SteamController")
    ).toBeNull();

    // And the guard detection itself, on both the direct and bundled forms.
    expect(AUTH_GUARD_REF.test('import { OwnerGuard } from "../auth/owner.guard";')).toBe(
      true
    );
    expect(AUTH_GUARD_REF.test("@WithViewer()")).toBe(true);
    expect(AUTH_GUARD_REF.test("export class OpenController {}")).toBe(false);
  });

  // End-to-end over real files, because the assertions above prove the parsing
  // but not that the lint wires it together — and a lint that cannot fail is
  // indistinguishable from one that passes.
  it("the AuthModule lint fails on the wiring that shipped broken", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vyoh-authmodule-lint-"));
    try {
      writeFileSync(
        path.join(dir, "steam.controller.ts"),
        'import { WithViewer } from "../auth/viewer";\nexport class SteamController {}\n'
      );
      writeFileSync(
        path.join(dir, "open.controller.ts"),
        "export class OpenController {}\n"
      );
      const moduleFile = path.join(dir, "steam.module.ts");
      const declare = (imports: string, controller: string) => {
        const file = controller === "SteamController" ? "steam" : "open";
        return `import { ${controller} } from "./${file}.controller";
@Module({ imports: [${imports}], controllers: [${controller}] })
export class SteamModule {}
`;
      };

      // The defect: guarded controller, no AuthModule in the declaring module.
      writeFileSync(moduleFile, declare("RiotModule", "SteamController"));
      expect(guardedModulesMissingAuth([moduleFile])).toHaveLength(1);

      // Fixed by the import that was missing.
      writeFileSync(moduleFile, declare("RiotModule, AuthModule", "SteamController"));
      expect(guardedModulesMissingAuth([moduleFile])).toEqual([]);

      // An unguarded controller is not required to import it.
      writeFileSync(moduleFile, declare("RiotModule", "OpenController"));
      expect(guardedModulesMissingAuth([moduleFile])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // repo-conventions.md: "The production image is a different environment" —
  // an Intl formatter with no `timeZone` resolves to the process zone, so a UTC
  // container and a visitor's browser disagree on any date near midnight and
  // React discards the server-rendered tree. The page still looks fine, which
  // is why this needs a lint rather than review.
  //
  // Balanced-paren scanning, not a regex: the options object nests, and the
  // 2026-08-07 sweep had formatters spanning six lines. A line-oriented rule
  // reads every one of those as unpinned.
  it("no unpinned date formatter in web", () => {
    const hits = collect(TIMEZONE_SCAN_ROOTS, (text) =>
      unpinnedFormatters(text).map((f) => `L${f.line}: ${f.snippet}`)
    );
    expect(
      hits,
      "Pass timeZone (OWNER_TIME_ZONE, or UTC for upstream date-only values)"
    ).toEqual([]);
  });

  // Guards the guard. `.toLocaleString` is the ambiguous one — it formats
  // numbers far more often than dates in this repo, and flagging
  // `count.toLocaleString("en-GB")` would get the lint disabled within a week.
  // So it counts only when the options carry a date/time field, while
  // toLocaleDateString / toLocaleTimeString / Intl.DateTimeFormat always do.
  it("the timezone lint spares number formatting and multi-line pinned formatters", () => {
    const flagged = [
      'new Intl.DateTimeFormat("en-GB", { month: "short" })',
      "d.toLocaleDateString()",
      'd.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })',
    ];
    for (const src of flagged) expect(unpinnedFormatters(src)).toHaveLength(1);

    const spared = [
      // Numbers, which is what .toLocaleString overwhelmingly means here.
      'count.toLocaleString("en-GB")',
      'n.toLocaleString("en-US", { maximumFractionDigits: 1 })',
      // Pinned, including across the line breaks Biome introduces.
      'new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: OWNER_TIME_ZONE })',
      'new Intl.DateTimeFormat("en-GB", {\n  month: "short",\n  timeZone: OWNER_TIME_ZONE,\n})',
      // UTC is a deliberate pin for upstream date-only values, not a miss.
      'new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" })',
      // A nested object must not hide the zone from the scan.
      'new Intl.DateTimeFormat("en-GB", { ...base, timeZone: OWNER_TIME_ZONE })',
    ];
    for (const src of spared) expect(unpinnedFormatters(src)).toEqual([]);
  });
});
