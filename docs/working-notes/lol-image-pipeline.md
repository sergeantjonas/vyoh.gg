# vyoh.gg — LoL image asset pipeline

Working plan for the image-loading arc. Read this when working on: champion icon / splash performance, the splash-resolver, build-time asset prefetch, the CI refresh workflow, runtime URL helpers, or the static-asset story in the hosting note.

This is a living plan. Phases are sequenced so each one ships value on its own. Phase 0 alone is enough to fix the worst pain.

Cross-references: [hosting.md](hosting.md) (deployment-side asset handling), [case-study-topics.md](case-study-topics.md) (write-up framing), [views-roadmap.md](views-roadmap.md) (downstream consumers of these assets).

---

## Why this exists

Today the app fetches every champion icon, splash, profile icon, and item icon from external CDNs:

- **wsrv.nl** — proxy on top of CDragon, returns resized WebP. Used for icons, card splashes, backdrop splashes, profile icons. The flakiness layer.
- **CDragon** (`cdn.communitydragon.org/latest`) — direct splash + icon source. No resize.
- **DDragon** (`ddragon.leagueoflegends.com`) — versioned source for items, loading portraits, last-resort splash, profile icon fallback.

Owner-observed pain: image loads can take **30–60 seconds** on first paint. Diagnosed root cause is in [`splash-resolver.ts`](../../apps/web/src/lol/_shared/splash-resolver.ts):

1. The probe (`new Image()` + `onload`/`onerror`) has **no timeout**. A hung wsrv.nl connection blocks indefinitely.
2. Probes run **sequentially**. If candidate 1 hangs, candidate 2 never runs. The fallback chain actively makes the tail latency worse.

The asset universe is also **bounded** — ~170 champions, ~250 items, ~50 commonly-used profile icons. Total at our render sizes: ~25–30MB. Small enough to self-host as build artifacts. Per-skin, per-locale, and PBE variants are out of scope (we don't render them).

---

## Goals

1. **Worst-case image wait < 2s.** Always, regardless of CDN state.
2. **Zero CDN dependency on the bundled set** for the happy path.
3. **Graceful degradation for the long tail** (new champion before CI catches up).
4. **Patch refresh is automated** — no manual work per Riot patch.

The non-goal: a backend image proxy with persistent storage. Parked. See "Parked" section.

---

## Guiding principles

- **One landable phase per session.** Each phase ships a perceptible improvement on its own.
- **Treat the bounded set as build artifacts.** Self-hosted assets are static files in `public/lol/`, refreshed on a cron, committed to the repo. Deploy never depends on CDN being up at deploy time.
- **The runtime never assumes a build-time success.** A manifest tells the URL helpers what's bundled; anything missing falls through to the existing CDN chain.
- **Belt + suspenders.** Even after self-hosting, keep the runtime fallback chain alive — but bound it with a timeout.
- **Portfolio framing matters.** This is a case-study-strong arc. Implementation choices that produce reviewable artifacts (PRs, manifest diffs, CI workflow) are preferred over invisible cleverness.

---

## Phase 0 — splash-resolver timeout + parallel race

**Goal:** Cap the worst-case image wait at ~2s. Independent of any asset pipeline. **Ship this first.**

**Files:** [`apps/web/src/lol/_shared/splash-resolver.ts`](../../apps/web/src/lol/_shared/splash-resolver.ts)

**Changes:**

1. Add per-probe timeout (default 2000ms):

   ```ts
   function probe(url: string, timeoutMs = 2000): Promise<boolean> {
     return new Promise((resolve) => {
       const img = new Image();
       const timer = setTimeout(() => resolve(false), timeoutMs);
       img.onload = () => { clearTimeout(timer); resolve(true); };
       img.onerror = () => { clearTimeout(timer); resolve(false); };
       img.src = url;
     });
   }
   ```

2. Race candidates in parallel rather than serially. Use `Promise.any` over the probe-promise list, with each candidate also racing its own internal timeout. First success wins. Order of preference still matters when multiple succeed — handle by giving later candidates a small artificial head-start delay, OR by preferring the result with the lowest index that resolved within a small grace window.

   Simpler alternative if parallel ordering is fiddly: keep the loop sequential but with the timeout, so worst case is `N × timeoutMs` (e.g. 6s for a three-candidate chain). That's already a 10× improvement on the current 60s. Pick the simpler version unless the metrics demand parallel.

**Success criteria:**

- Manual test: with DevTools network throttled to "Slow 3G" + a deliberately-broken primary URL, no image takes longer than `(N+1) × timeoutMs` to settle to a fallback.
- Existing tests pass (the splash-resolver isn't directly unit-tested today; add minimal coverage if it's not too costly).

**Effort:** 30 min implementation + manual verification.

**Status: shipped 2026-05-13.** Sequential-with-timeout chosen over parallel `Promise.any` — the bound `N × timeoutMs` (≈6s for a 3-candidate chain, down from the unbounded 30–60s tail) is already a 10× improvement, and the simpler shape preserves the existing candidate-order preference without head-start tricks. Default `timeoutMs = 2000`. Unit coverage added at [`splash-resolver.test.ts`](../../apps/web/src/lol/_shared/splash-resolver.test.ts) stubbing `globalThis.Image` to drive the timeout and onload paths under fake timers. Owner verified manually on 2026-05-13 by repointing the wsrv.nl primary at the non-routable IP `10.255.255.1` to force a TCP-level hang — splashes settled to the CDragon fallback within ~2s instead of the pre-fix 30s+ wait.

---

## Phase 1 — build-time prefetch + manifest

**Status: shipped 2026-05-13.** Patch 16.10.1. 191 champions × 3 variants (6.4MB), 705 items (2.8MB), 103 runes (412KB), 23 summoner spells (84KB), 5 role-icon SVGs (20KB). Total ≈9.7MB, manifest 244KB. URL helpers (`champion-icon.ts`, `role-icon.tsx`, `use-perks.ts`, `use-summoner-spells.ts`) prefer the manifest and fall through to the existing wsrv.nl/CDragon chain on miss; Phase 0's bounded splash-resolver still guards the fallback path. Profile icons remain on wsrv.nl per Decision 5.

**Goal:** Self-host the bounded asset set. Cold loads serve every common image from origin. wsrv.nl drops out of the critical path.

**New files:**

- `scripts/refresh-lol-assets.ts` — the prefetch + manifest script
- `apps/web/public/lol/manifest.json` — runtime-readable manifest of bundled assets
- `apps/web/public/lol/champions/<champion>/{square,card,backdrop}.webp`
- `apps/web/public/lol/items/<itemId>.webp` — native 64×64 source, WebP q=85
- `apps/web/public/lol/runes/<keystoneId>.webp` — keystones + secondary runes (~70 total)
- `apps/web/public/lol/summoner-spells/<spellKey>.webp` — Flash, Ignite, etc. (~30 total)
- `apps/web/public/lol/role-icons/<position>.svg` — TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY
- `apps/web/public/lol/champion-summary.json` — moved from runtime fetch to build-time artifact

**Profile icons are intentionally not bundled** (6000+ in game, sparse usage). They keep their existing runtime path through wsrv.nl with the Phase 0 timeout providing the safety net.

**Modified files:**

- [`apps/web/src/lol/_shared/champion-icon.ts`](../../apps/web/src/lol/_shared/champion-icon.ts) — every URL helper checks the manifest first, falls back to existing wsrv.nl chain if the asset isn't bundled
- [`apps/web/src/lol/_shared/summoner-icon.ts`](../../apps/web/src/lol/_shared/summoner-icon.ts) — **unchanged** for profile icons (intentional skip), but if it has helpers for summoner-spell icons too, those route through the manifest
- [`apps/web/src/lol/_shared/role-icon.tsx`](../../apps/web/src/lol/_shared/role-icon.tsx) — `roleIconUrl` returns the bundled `/lol/role-icons/<slug>.svg` path; existing `RoleIconFallback` SVG stays as deepest fallback
- [`apps/web/src/lol/_shared/use-summoner-spells.ts`](../../apps/web/src/lol/_shared/use-summoner-spells.ts) — manifest-aware
- [`apps/web/src/lol/_shared/use-perks.ts`](../../apps/web/src/lol/_shared/use-perks.ts) — manifest-aware (runes/keystones)
- [`apps/web/src/lol/_shared/keystone-icon.tsx`](../../apps/web/src/lol/_shared/keystone-icon.tsx) — manifest-aware
- [`apps/web/src/lol/champions/use-champions.ts`](../../apps/web/src/lol/champions/use-champions.ts) — read `champion-summary.json` from `/lol/` instead of CDragon at runtime
- [`apps/web/src/lol/_shared/champion-assets.json`](../../apps/web/src/lol/_shared/champion-assets.json) — **stays as theme/blurhash data**. Refresh script updates this file alongside the new manifest in one pass, so blurhash regenerates when a splash changes (rework). Single-responsibility split intentional.
- `package.json` — add `refresh:lol-assets` script, `sharp` as a dev dependency
- `.gitignore` — ignore `.cache/lol-images/`

### Manifest schema

```jsonc
{
  "patch": "14.10.1",
  "generatedAt": "2026-05-10T06:00:00Z",
  "champions": {
    "Lux": {
      "square": { "path": "/lol/Lux/square.webp", "hash": "abc123…", "bytes": 4521 },
      "card":   { "path": "/lol/Lux/card.webp",   "hash": "def456…", "bytes": 78912 },
      "backdrop": { "path": "/lol/Lux/backdrop.webp", "hash": "…", "bytes": 41203 }
    },
    "MonkeyKing": { /* aliased to Wukong-display, key matches MatchSummary.champion */ }
  },
  "items":           { "6675": { "path": "/lol/items/6675.webp",                    "hash": "…", "bytes": 1843 } },
  "runes":           { "8005": { "path": "/lol/runes/8005.webp",                    "hash": "…", "bytes": 1240 } },
  "summonerSpells":  { "4":    { "path": "/lol/summoner-spells/SummonerFlash.webp", "hash": "…", "bytes": 1103 } },
  "roleIcons":       { "MIDDLE": { "path": "/lol/role-icons/middle.svg",            "hash": "…", "bytes": 612  } },
  "missing": [
    { "kind": "champion", "key": "ZyraRework", "reason": "404 from CDragon and DDragon at 2026-05-10T06:00:00Z" }
  ]
}
```

The runtime URL helpers read the manifest once at module init (it's small enough to import directly):

```ts
import manifest from "/lol/manifest.json";

export function championSquareIconUrl(name: string, width = 72): string {
  const entry = manifest.champions[normalizeChampionAlias(name)]?.square;
  if (entry) return entry.path;
  // Long tail — fall through to existing wsrv.nl chain. Phase 0 timeout still bounds the wait.
  return wsrvSquareUrl(name, width);
}
```

**Important:** `champion-assets.json` already exists at [`apps/web/src/lol/_shared/champion-assets.json`](../../apps/web/src/lol/_shared/champion-assets.json). Decide before starting whether the new manifest replaces it, extends it, or coexists. They should not both be sources of truth for champion identity.

### Script behavior

`scripts/refresh-lol-assets.ts` walks the bounded asset universe and:

1. Reads existing manifest (if any).
2. Fetches latest version (`https://ddragon.leagueoflegends.com/api/versions.json[0]`) and champion summary.
3. For each asset:
   - Compute candidate URL chain (wsrv.nl preferred, CDragon direct, DDragon).
   - If file exists locally **and** upstream HEAD/hash matches manifest hash → skip.
   - Otherwise, fetch from candidate chain with retry/backoff (3 attempts × 5s). Sharp-process to our variants.
   - Write file, record `{ path, hash, bytes }` in new manifest.
   - On full failure: record under `missing[]`, do not fail the build.
4. Threshold check: if `missing.length / total > 0.05`, exit non-zero (something structural is broken upstream).
5. Write new manifest + `champion-summary.json`.
6. Print summary: `Refreshed N (X new, Y updated, Z missing).`

**Modes:**
- Default — incremental (skip unchanged).
- `--full` — re-fetch everything; use after schema change to manifest or major Riot rework.
- `--gaps-only` — retry only `missing[]` entries.

**Cache:** `.cache/lol-images/<hash-of-source-url-and-sharp-params>.webp`. Gitignored. Speeds up subsequent runs (no-op refresh ≈ seconds).

### Sharp variants to produce per champion

| Variant | Source | Sharp params |
|---|---|---|
| `square.webp` | CDragon `champion/<key>/square` | resize w=72, WebP q=85 |
| `card.webp` | CDragon `champion/<key>/splash-art/centered` | resize w=500, WebP q=90 |
| `backdrop.webp` | CDragon `champion/<key>/splash-art/centered` | resize w=600, blur σ≈1, WebP q=80 |

For items: DDragon `cdn/<patch>/img/item/<id>.png` (native 64×64), WebP q=85, no resize.

For runes / keystones: CDragon `plugins/rcp-be-lol-game-data/global/default/v1/perk-images/...`, native source resolution, WebP q=85.

For summoner spells: DDragon `cdn/<patch>/img/spell/<key>.png` (native 64×64), WebP q=85, no resize.

For role icons: pass-through SVG from `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-<slug>.svg`. No transform — write as-is.

**Profile icons are not bundled.** Their existing runtime path through wsrv.nl stays in place.

### Asset commit policy

- Commit the assets and manifest to the repo.
- Cache directory `.cache/lol-images/` gitignored.
- Initial commit adds ~25MB. Subsequent refresh PRs touch only changed files (rare — Riot rarely re-renders existing splashes).

**Success criteria:**

- DevTools Network on cold load shows zero requests to wsrv.nl / cdn.communitydragon.org / ddragon.leagueoflegends.com for any rendered champion or item.
- Manifest entries match files on disk (validation step in the script).
- Render the app with the network panel set to "offline" after one successful load — every common image still renders.
- A deliberately-deleted manifest entry triggers the long-tail fallback, which renders the asset via wsrv.nl with the Phase 0 timeout.

**Effort:** One full session. The Sharp pipeline + manifest schema is the chunky part; the URL-helper rewrites are mechanical.

### Build log

In-progress notes worth remembering for the case study. Append per chunk; do not rewrite history.

**Chunk 1 (2026-05-13) — refresh script + champions pipeline.** Shipped: [`scripts/refresh-lol-assets.mts`](../../scripts/refresh-lol-assets.mts), manifest schema v1, 191 champions × 3 variants under `apps/web/public/lol/champions/` (~6.4MB), `champion-summary.json` move, theme/blurhash regen wired through the same script in one pass.

Surprises:
- **Script is `.mts`, not `.ts`.** Root `package.json` has no `"type": "module"`, so tsx defaults to CJS and refuses top-level await + `import.meta.url`. `.mts` forces ESM per file without disturbing the rest of the repo.
- **`sharp` + `tsx` + `blurhash` installed at the workspace root**, not in `apps/web`. The runner script lives at root and pnpm hoisting is unreliable for the native `sharp` binary; co-locating avoids a CI-only failure.
- **`urlPathToDiskPath` exists because `path.join(root, "apps/web", "/lol/x")` silently drops `public/`.** First run wrote 6MB of WebPs to `apps/web/lol/` (no `public/`); the in-script consistency assertion used the same buggy path and missed it. Caught by `du -sh` on the expected output dir. Lesson: assertions that re-derive the path they're checking aren't assertions — manifest URLs and disk paths need a single mapping helper.
- **Patch-bump detection triggers an implicit `--full`.** CDragon serves "latest" with no version key; if the patch changed underneath us, every cached entry is suspect. Sidesteps the question of per-source ETags entirely for Phase 1.

---

## Phase 2 — automated patch refresh (CI)

**Goal:** No manual work per Riot patch. The repo stays current via auto-PR.

**New files:**

- `.github/workflows/refresh-lol-assets.yml`

**Workflow shape:**

```yaml
on:
  schedule:
    - cron: '0 6 * * *'   # daily 06:00 UTC, ~01:00 EDT
  workflow_dispatch:        # manual trigger from the Actions tab

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v4
        with:
          path: .cache/lol-images
          key: lol-images-${{ hashFiles('apps/web/public/lol/manifest.json') }}
          restore-keys: lol-images-
      - run: pnpm refresh:lol-assets
      - uses: peter-evans/create-pull-request@v6
        with:
          branch: automated/lol-asset-refresh
          title: 'chore: refresh lol assets (patch ${{ steps.refresh.outputs.patch }})'
          labels: automated:asset-refresh
          body: |
            Automated refresh.
            ${{ steps.refresh.outputs.summary }}
```

**PR body content** (generated by the script — pipe its summary into a step output):

- Detected patch version
- Counts: `X champions added`, `Y champions updated (rework?)`, `Z items added`, `N still missing`
- File-level summary if practical

**Auto-merge guardrails** (optional, can defer):

- If the diff is **purely additive** (only new files) → auto-merge after CI passes.
- If existing files changed (rework) → require human review. Splash reworks are visible UX changes worth eyeballing.

**Cadence rationale:**

- Daily cron is the right balance. Riot patches drop on Wednesdays; 24h max lag is invisible to users.
- The runtime long-tail fallback handles the gap between patch drop and CI catch-up.

**Validation:**

- The PR runs existing `verify:cc` (typecheck + tests + lint). Catches manifest-schema breakages and broken URL-helper references.
- A small Playwright smoke test (renders Profile + Champions list, asserts icon nodes are present and have non-zero `naturalWidth`) is cheap insurance. **Defer unless we see a regression** — `verify:cc` catches the structural class of failures.

**Self-healing behavior:**

- A previously-`missing` champion that's now available on CDragon is automatically picked up by the next nightly run.
- Asset cache key is tied to the manifest hash, so the cache invalidates correctly when assets change.
- A failed cron run does no damage (no PR opens). Next day's run tries again.

**Effort:** Half a session once Phase 1 is in. Most complexity is iterating on the PR body template until it reads well.

---

## Phase 3 — service worker (polish, defer)

**Goal:** Belt + suspenders. Survive a deploy that breaks `public/`. Offline-capable thumbnails after first visit.

**Status: deferred.** Phases 0–2 fix the user-visible problem entirely. SW is a portfolio bullet, not a pain reliever.

If/when we do this, scope:

- Workbox or hand-rolled. ~150 LOC either way.
- Cache-first with stale-while-revalidate on `/lol/**` and the long-tail CDN URLs.
- Skip-waiting + clientsClaim with care (the standard SW update foot-gun).
- Pre-cache the manifest entries on `install` for instant offline-first behavior.

Note: SW caching of long-tail CDN URLs is the part that genuinely buys something post-Phase 1. The bundled `/lol/**` paths are already served with strong cache headers by every hosting option (see [hosting.md](hosting.md)).

---

## Parked

### Backend image proxy

Originally considered as Tier 3. Replaced by Phase 1 (build-time prefetch). The proxy framing — Nest controller + Sharp + R2/S3 — is overkill for a portfolio app's actual needs once self-hosting is in place. **However**, it's a strong standalone write-up topic ("how I built a typed CDN with Sharp + R2"). If a future project genuinely needs unbounded asset handling (user uploads, dynamic transforms), this design becomes the right one.

Don't implement here. Worth referencing from [case-study-topics.md](case-study-topics.md) as a parked-but-considered option.

### Per-locale and per-skin variants

Out of scope. We render base champion in en_US only. If localization happens later, the manifest schema is already keyed in a way that supports `locale` extension.

### PBE patch tracking

Out of scope. Noisy and irrelevant for the live app.

---

## File layout (target end state)

```
.cache/lol-images/                            # gitignored, sharp output cache
.github/workflows/refresh-lol-assets.yml      # daily refresh
apps/web/public/lol/
  manifest.json                               # runtime-readable, source of truth
  champion-summary.json                       # moved from runtime fetch
  champions/<champion>/{square,card,backdrop}.webp
  items/<itemId>.webp                         # native 64×64
  runes/<keystoneId>.webp
  summoner-spells/<spellKey>.webp
  role-icons/<position>.svg                   # pass-through, no transform
apps/web/src/lol/_shared/
  champion-icon.ts                            # manifest-aware URL helpers
  summoner-icon.ts                            # manifest-aware
  splash-resolver.ts                          # Phase 0 timeout + (optional) parallel race
scripts/
  refresh-lol-assets.ts                       # the script
package.json                                  # `refresh:lol-assets` script entry
```

---

## Hosting implications (cross-ref)

[hosting.md](hosting.md) covers deploy options. The image pipeline interacts with hosting in three ways:

1. **Static asset serving.** `apps/web/public/lol/**` is served by whichever host serves the frontend. Vercel auto-applies long `Cache-Control` to `public/`; Railway and a Hetzner/Nginx setup need explicit config. See hosting.md for per-option notes.
2. **Deploy artifact size.** +25MB at first commit, small deltas after. None of the hosting options choke on this.
3. **CI workflow has no hosting dependency.** `peter-evans/create-pull-request` only needs default `GITHUB_TOKEN`. Works regardless of where the frontend deploys.

The **runtime long-tail fallback** still goes to wsrv.nl / CDragon / DDragon, which means CORS and CSP must permit those origins. They do today via direct `<img>` tags (no fetch policy needed). If we add a `Content-Security-Policy` header at the hosting layer later, the `img-src` directive needs to include `https://wsrv.nl`, `https://cdn.communitydragon.org`, `https://ddragon.leagueoflegends.com`, and `'self'`.

---

## Failure modes & self-healing

| Failure | Effect | Recovery |
|---|---|---|
| CDN flaky during refresh | Some entries land in `missing[]` | Next nightly `--gaps-only` run retries |
| Threshold breach (>5% missing) | Refresh exits non-zero, no PR | Check the run logs, manual `--full` if needed |
| Patch detected but assets unchanged | Manifest `patch` field updates, no file diffs | Refresh PR is mostly empty — fine, merge or skip |
| Champion renamed | Old key in `missing[]`, new key added | `normalizeChampionAlias` handles drift; PR review catches and we update the helper if needed |
| Manifest schema drift after script change | Script `--full` rebuild required | Documented; bump a `schemaVersion` field if we go through this twice |
| Runtime: bundled file accidentally deleted | URL helper reads manifest entry, points to nonexistent file → 404 | Manifest is the source of truth; if we trust it, this is a script bug. Mitigation: script's final step asserts every manifest entry has a corresponding file on disk |
| Runtime: manifest stale relative to bundled files | Untracked file is treated as not-bundled, falls through to CDN | Acceptable — no broken state, just suboptimal cache |
| Hosting: deploy strips `public/lol/**` | Whole bundled set vanishes | Every asset falls through to CDN with Phase 0 timeout. App works, slowly. Detected by Lighthouse / monitoring |

---

## Success metrics (for the case study)

Capture before/after:

- **Cold-load image waterfall** — total external requests, total bytes from external origins
- **Lighthouse LCP / CLS** on Profile and Match list
- **Worst-case image render time** under throttled network (synthetic)
- **PR cadence** for asset refresh (qualitative — "auto-PRs land weekly without my involvement")

These become the meat of the [case-study-topics.md](case-study-topics.md) entry on this arc.

---

## Decisions (resolved 2026-05-10)

1. **Manifest coexists with `champion-assets.json`.** Different concerns: `champion-assets.json` holds theme metadata (dominantHex, blurhash); the new `manifest.json` holds asset paths/hashes. Keep both as separate single-responsibility files. The refresh script updates **both** in one pass — when a champion's splash changes, theme + blurhash regenerate alongside the new asset hash, so they can never desync.
2. **Auto-merge purely-additive PRs from day one.** Modified-file diffs (reworks, updated existing assets) still require human review. Solo project — cheap to flip the toggle if it bites.
3. **Inline the manifest into the JS bundle.** Direct `import` of `manifest.json` at module init. Synchronous availability, no race condition, no spurious CDN fall-through during a network gap. Fetch was rejected: the manifest can't update without a deploy anyway (it references files that ship with the bundle), so fetching gains nothing real.
4. **Item icons bundled at native source resolution (64×64) with no variants.** WebP q=85. ~250 items × ~3KB ≈ 800KB. Covers our largest display target (~40px today, comfortable headroom up to 50px) with retina headroom. If sharper icons matter later, CDragon has higher-res data-driven endpoints for some items — pursue then, not now.
5. **Bundle scope expanded:**
   - **Keystones / runes (~70):** bundle. ~140KB.
   - **Role icons (5):** bundle the official CDragon SVGs. The inline `RoleIconFallback` in [role-icon.tsx](../../apps/web/src/lol/_shared/role-icon.tsx) stays as the deepest fallback when even bundled SVGs fail to load.
   - **Summoner spells (~30):** bundle. ~60KB.
   - **Profile icons (6000+ in game):** **skip** — bundle is unbounded vs. sparse usage. Runtime fetch through wsrv.nl + Phase 0 timeout is the right call.

These decisions are baked into the phase plans above. Anything that re-opens them belongs in a new "Open questions" section, not in this one.

---

## Connections to existing notes

- [hosting.md](hosting.md) — static asset serving per hosting option, CSP considerations. Has a section pointing back here.
- [case-study-topics.md](case-study-topics.md) — write-up framing for the full arc.
- [vnext-ideas.md](vnext-ideas.md) — pre-Phase-0 record of the "30–60s waits hurt" problem if it's listed there.
- [project-history.md](project-history.md) — once shipped, summarize the arc here as a landed initiative.
