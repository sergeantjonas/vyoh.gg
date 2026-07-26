# Biome 1.9.4 → 2.x migration

**Status:** Planned, not started. Evaluated and deferred 2026-07-26 with a full in-repo measurement. **The motivation is staying on the maintained line, not fixing bugs** — the triage below found essentially zero production defects behind the 599 diagnostics. Pick this up when one of the revisit triggers fires, not on version-currency instinct alone.

Read this before re-proposing the bump. A previous estimate put it at "~571 errors / 189 warnings, 23 needing judgement", which was both wrong in magnitude and wrong about what the findings *are*.

---

## Measurement (2026-07-26, `@biomejs/biome@2.5.5`)

`biome migrate --write` converts `biome.json` cleanly in one pass (4 mechanical key changes). Then `biome ci .` over **1,156 files**: **599 errors, 79 warnings**.

| Count | Rule | Auto-fix | Triaged verdict |
|---|---|---|---|
| 511 | `assist/source/organizeImports` | yes | Mechanical. v2 sorts named specifiers *inside* the braces, which v1 did not. Pure churn. |
| 28 | `complexity/useOptionalChain` | yes | Style. |
| 15 | `style/noDescendingSpecificity` | no | CSS, new in v2. Untriaged. |
| 15 | `correctness/noUnknownTypeSelector` | no | CSS. Suspect Tailwind / custom selectors. Untriaged. |
| 15 | `suspicious/noTemplateCurlyInString` | no | Untriaged; expected to be mostly fixture strings. |
| 10 | `correctness/useHookAtTopLevel` | no | **All false positives.** See below. |
| 9 | `correctness/noUnsafeOptionalChaining` | no | **Real but trivial.** See below. |
| 9 | `complexity/noImportantStyles` | no | CSS `!important`. Expected to be deliberate. |
| 19 | `a11y/*` | no | 10 `useSemanticElements`, 5 `useAriaPropsSupportedByRole`, 3 `noStaticElementInteractions`, 1 `noSvgWithoutTitle`. Untriaged, and the most likely place for genuine value. |
| 4 | `suspicious/noArrayIndexKey` | no | Untriaged. |
| 3 | `correctness/noUnknownProperty` | no | CSS. |
| 1 each | `useIterableCallbackReturn`, `noUnusedVariables`, `noUnusedImports`, `noUnknownMediaFeatureName` | mixed | Tail. |

### The two correctness rules that looked most promising, triaged

Both were the headline reason to consider the upgrade. Neither survives inspection.

- **`useHookAtTopLevel` (10) — all false positives, all in one file.** Every hit is in [chapter-multi-beat.tsx](../../../apps/web/src/home/recap/chapter-multi-beat.tsx), whose render function is `ChapterMultiBeatImpl` exported as `forwardRef(ChapterMultiBeatImpl)` at `:373`. Biome 2 does not trace hooks through `forwardRef(namedFunction)`, so it reads a legitimate component as "a function that is not a hook or component". No conditional-hook bug exists.
- **`noUnsafeOptionalChaining` (9) — real, trivial, and entirely in test files.** All are the shape `(x?.y as SomeType).z`, on the line directly after an `expect(x).not.toBeNull()`. The rule is technically correct (if `x` were null the cast would throw) but the assertion above rules that out. Fixing them means either restructuring the assertions or adding non-null assertions, and the repo currently has **zero** non-null assertions in production code, a property worth more than these nine.

**Conclusion: no production bug is hiding behind these 599 diagnostics.** The untriaged a11y group is the one place remaining value could plausibly sit.

## Blockers

1. **Biome 2 fails to parse [`apps/web/src/index.css`](../../../apps/web/src/index.css).** This is a *capability regression* against v1, which parses it fine. Until it is understood, every CSS count above is unreliable and the upgrade trades away working coverage of the project's main stylesheet.
2. **~88 findings survive the auto-fixes**, so a mechanical-only first commit leaves `check:cc` red and breaks both the pre-commit gate and `main`. Staging requires deliberately setting the unresolved rules to `off` with documented reasons, which is an owner decision.
3. **The 511-file import churn buys no correctness.** It rewrites the import block of nearly every source file, which destroys `git blame` usefulness there and conflicts with anything in flight.

## Why "just enable the good rules on 1.9.4" does not work

Tried on 2026-07-26. Four of the five correctness rules (`noUnsafeOptionalChaining`, `useHookAtTopLevel`, `noArrayIndexKey`, `useOptionalChain`) **do exist in 1.9.4**, so this looked like a way to take the value without the migration.

Enabling all four on 1.9.4 reports **3 findings, all false positives**: `useHookAtTopLevel` flags `app.useGlobalPipes()`, `app.useGlobalInterceptors()` and `app.useGlobalFilters()` in [apps/api/src/main.ts](../../../apps/api/src/main.ts) as React hooks, purely on the `use*` prefix. v1's implementations of the other three find nothing at all.

So the rules exist in name only; v2's analysis is what produces the findings. There is no cheap path to the value, and as triaged above, not much value at the end of the expensive path either.

## Chunk plan, when it is picked up

Do **not** start this without deciding chunk 0 first.

- **Chunk 0 (decision, blocking).** Owner call: stage behind temporarily-disabled rules, or land one large commit fixing all ~88? Everything below assumes staged.
- **Chunk 1.** Diagnose the `index.css` parse failure. If v2 cannot read it, stop and re-evaluate the whole arc; a linter that reads the main stylesheet worse than the current one is not an upgrade.
- **Chunk 2.** Bump + `migrate --write` + `check --write` (the 539 auto-fixable) + explicitly disable the unresolved rules in `biome.json`, each with a one-line reason. Must land green. Expect a ~511-file diff; land it alone, on a quiet tree, with nothing else in flight.
- **Chunk 3.** CSS rules re-enabled one at a time: `noDescendingSpecificity`, `noUnknownTypeSelector`, `noImportantStyles`, `noUnknownProperty`, `noUnknownMediaFeatureName`. Expect most to end up `off` with a Tailwind rationale.
- **Chunk 4.** a11y group (19). The highest-value chunk; do this one even if the rest stalls.
- **Chunk 5.** Correctness tail, knowing from the triage above that `useHookAtTopLevel` should be `off` (forwardRef false positives) and `noUnsafeOptionalChaining` is test-only cosmetics.

## Revisit triggers

Any one of:

- `index.css` parses cleanly under a v2 release.
- A CSS pass is happening anyway, so chunk 3 rides along.
- A dependency, Node version, or editor integration forces v2.
- Biome 1.x stops receiving a fix that is actually needed. Note it is a dev dependency that never ships to users, so being a major behind carries little real risk.
- Biome fixes `forwardRef` tracing in `useHookAtTopLevel`, which would make that rule worth having.

Do **not** re-propose this on version-currency grounds alone. The considered deferral, recorded here, is the better artifact for a repo that doubles as a portfolio piece — the same reasoning that had `concurrently` 10 reverted in `eb5ac211` after it was shown to regress the security posture.
