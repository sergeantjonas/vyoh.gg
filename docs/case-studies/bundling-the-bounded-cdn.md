# Bundling the bounded CDN — a three-phase fix for flaky LoL image delivery

## TL;DR

The dashboard's hero visuals — champion splashes, item icons, role glyphs — were fetched at runtime via [wsrv.nl](https://wsrv.nl/) proxying [Community Dragon](https://www.communitydragon.org/) and [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). Under load the proxy returned non-deterministically: some cards loaded, some hung for 30–60s, none failed cleanly. The fix was three phases shipped over a week. **Phase 0** put a 2s timeout on each probe in the resolver fallback chain so the worst case was bounded. **Phase 1** turned the runtime CDN into a build-time pipeline: a `tsx` script downloads, transforms (Sharp), hashes, and emits ~9.7 MB of WebPs to `public/lol/**` plus a `manifest.json` that the URL helpers consult first. **Phase 2** put that script on a daily GitHub Actions cron with an auto-PR that labels purely-additive diffs for auto-merge. The runtime fallback chain to wsrv.nl is still there, intact, as a long-tail safety net — but on the common path every champion image now comes from the bundle. This case study walks the arc and the surprises along the way.

## Setup

[vyoh.gg](https://vyoh.gg) renders a lot of champion art. Match cards stack 10 champion squares per row, the profile page foregrounds a splash backdrop, the live-game chip shows summoner spells and keystones inline. The image universe is **bounded and slow-changing** — ~170 champions × 3 variants (square / centered card / blurred backdrop), ~250 items, ~70 runes, ~30 summoner spells, 5 role icons. Riot ships a new patch every two weeks; existing splashes change rarely.

Two CDNs serve that universe:

- **Data Dragon** — Riot's official static CDN. Versioned per patch (`/cdn/14.10.1/img/champion/Ahri.png`). Reliable but origin-only — no resize, no WebP. Champion squares are 120×120 PNGs; serving them as-is wastes bytes.
- **Community Dragon** — community-maintained derivative CDN. Has the "centered splash" crop and other derived assets Data Dragon lacks. Patch-pinned via `/latest/` paths, which means CDragon serves whatever the newest patch is — no version key, no negotiation.

The runtime layer routed both through [wsrv.nl](https://wsrv.nl/), a free image proxy that resizes / converts to WebP / blurs on demand. Convenient — one `<img src>` and you get a Sharp-pipeline output from a CDN you didn't have to operate. The cost was operational: a free proxy in the request path with no SLA, no observability, and on bad days, no consistency.

## The symptom

On a cold profile load, splash + 20 match cards × 10 champion squares = ~210 wsrv.nl requests in a single waterfall, all for the same handful of champions. Most loaded in under a second. A small slice took 30–60s. A smaller slice never returned — the connection stayed open, the request stayed in-flight, the `<img>` never fired `error` or `load`. The browser's tab spinner kept spinning long after the page was usable.

The interaction with the runtime fallback chain made it worse. The splash backdrop ran [splash-resolver.ts](../../apps/web/src/lol/_shared/splash-resolver.ts):

```ts
for (const url of candidates) {
  if (await probe(url)) { result = url; break; }
}
```

`probe(url)` was a `new Image()` race against `onload` / `onerror`. The first candidate was wsrv.nl. If wsrv.nl hung, the probe never settled, the loop never advanced, the chain never reached the working Data Dragon URL underneath. One stuck probe ate the whole fallback.

## Phase 0 — bound the worst case

The diagnosable problem ("wsrv.nl is flaky") was much bigger than the fix needed for it. The chain already had Data Dragon as the last-resort candidate; we just had to ever reach it. Adding a per-probe deadline:

```ts
const timer = setTimeout(() => settle(false), timeoutMs);
img.onload = () => settle(true);
img.onerror = () => settle(false);
img.src = url;
```

…makes a hung probe indistinguishable from a 404 from the loop's perspective. Worst case becomes `candidates.length * timeoutMs`, deterministic and small (2s × 3 = 6s). Cards that had previously hung indefinitely now resolved to the Data Dragon fallback within seconds.

Shipped as `fd0754e`. ~15 lines of diff. The dashboard stopped hanging. The architectural problem — **a free proxy in our render path** — was untouched, but it was no longer urgent.

## Phase 1 — turn the runtime CDN into a build artifact

With the bleeding stopped, the real fix was to delete the proxy from the common path. The image universe is bounded, the patches are biweekly, the bundle cost is small. A build-time prefetch can replace the runtime CDN entirely for the hot set, and the wsrv.nl chain becomes a long-tail safety net rather than the primary route.

The shape that emerged:

```
.cache/lol-images/                      # gitignored Sharp input/output cache
apps/web/public/lol/
  manifest.json                         # single source of truth — hashes, paths, patch
  champions/<alias>/{square,card,backdrop}.webp
  items/<id>.webp
  runes/<id>.webp
  summoner-spells/<key>.webp
  role-icons/<position>.svg
scripts/refresh-lol-assets.mts          # the pipeline (~700 LOC)
```

The script is [scripts/refresh-lol-assets.mts](../../scripts/refresh-lol-assets.mts). It fetches the current patch from `versions.json`, walks the champion summary, downloads each variant from CDragon (cached by source-URL hash so re-runs are cheap), pipes through Sharp for resize + WebP encode, writes the file, and records `{path, hash, bytes}` in the manifest. Items, runes, summoner spells, and role icons go through a shared `processSimpleAsset` driver — same shape, same retry, same `manifest.missing[]` bucket on failure. The whole pipeline is one `pnpm refresh:lol-assets` run.

Three properties of the manifest are load-bearing:

- **Hash-keyed.** Every asset entry has a SHA-256 of the encoded WebP. Phase 2 reads these to diff PR-to-PR and decide if a refresh is purely additive.
- **Inlined into the bundle.** The manifest is `import`ed at module init, not fetched. It can't lag the assets it references because they ship together. No "manifest stale relative to disk" race.
- **Missing-aware.** When CDragon doesn't have an asset (new champion not yet rendered, deprecated item), the key lands in `manifest.missing[]` with a kind and reason. The URL helpers see a manifest miss, fall through to the wsrv.nl chain, and the runtime path still works — bounded by the Phase 0 timeout.

Each URL helper in [apps/web/src/lol/_shared/champion-icon.ts](../../apps/web/src/lol/_shared/champion-icon.ts) checks the manifest first:

```ts
export function championSquareIconUrl(championName: string, width = 72): string {
  const manifestPath = getChampionAsset(championName, "square");
  if (manifestPath) return manifestPath;
  // long-tail fallback through wsrv.nl + Phase 0 timeout
  return `https://wsrv.nl/?url=...&w=${width}&output=webp&q=85`;
}
```

The fallback chain is deliberately preserved. New champions appear on CDragon before they appear in the bundle (the daily cron lags by up to 24h); a fully self-healing system needs the fallback to exist. Defense in depth, not either/or.

Result: cold load on a profile page makes **zero external image requests** for any champion in the bundled set. The bundle gained ~9.7 MB. The page got faster, deterministically.

Shipped as `cce4e00` (script + assets), `7ca3c5f` (item / rune / spell / role coverage), `1d457a3` (URL helpers).

## Phase 2 — automate the patch lag

The remaining manual step was running the script after each Riot patch. A daily GitHub Actions cron closes that gap. [.github/workflows/refresh-lol-assets.yml](../../.github/workflows/refresh-lol-assets.yml):

```yaml
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
```

The workflow restores `.cache/lol-images` via `actions/cache@v4` keyed on the manifest hash — so an unchanged manifest means an instant cache hit and a no-op run. The script emits `patch`, `additive`, `no-changes`, and a multiline `summary` to `$GITHUB_OUTPUT`; the workflow consumes those into a [peter-evans/create-pull-request@v6](https://github.com/peter-evans/create-pull-request) call. A gate step skips PR creation entirely when `no-changes=true`, so quiet days produce no noise.

Labels are computed from `additive`:

```bash
if [ "${{ steps.refresh.outputs.additive }}" = "true" ]; then
  printf 'labels<<EOF\nautomated:asset-refresh\nautomerge\nEOF\n' >> "$GITHUB_OUTPUT"
else
  printf 'labels<<EOF\nautomated:asset-refresh\nEOF\n' >> "$GITHUB_OUTPUT"
fi
```

A purely-additive refresh (new champion lands on CDragon, no existing assets change) gets `automerge` and rolls itself in once CI passes. A diff that touches existing files — most commonly a champion rework where CDragon re-renders an existing splash — falls to human review, because reworks are visible UX changes worth eyeballing.

CI still runs [pnpm run verify:cc](../../package.json) on the PR — Biome lint + monorepo typecheck + workspace tests. That catches the structural class of failures (manifest schema drift, broken URL-helper references). A Playwright visual smoke test was scoped and deferred — the structural checks were enough to ship without it.

Shipped as `b5f10a8`.

## What worked

**Phasing the fix.** Phase 0 was 15 lines and shipped in under an hour; it stopped the user-visible pain immediately. That bought time to design Phase 1 without urgency, which meant the manifest schema got the attention it needed instead of being rushed. If I'd jumped straight to "let's bundle everything," the runtime probe bug would have stayed unfixed for the whole week the bundling took.

**Manifest as single source of truth.** Inlining the manifest into the JS bundle (vs. fetching it at runtime) eliminated a whole class of race-condition bugs. The URL helpers can't ever read a stale manifest because they read it *out of the same bundle* that references the assets. There's no transport, no cache, no negotiation — just `import`.

**Hash-based diffing for the auto-PR.** Computing `added` / `updated` / `removed` per bucket from manifest hashes made the auto-merge decision trivial. A purely-additive diff is unambiguous: no existing file's hash changed. That's a strong enough invariant that auto-merging it solo-project feels safe; reworks (the only visually-risky case) consistently land in the `updated` bucket and bypass auto-merge.

**Defense in depth on the fallback.** Preserving the wsrv.nl chain after bundling looks redundant on a happy-path waterfall ("but we don't need it any more!"). It is exactly the thing that lets the daily cron run, well, daily — new champions hit production on CDragon hours or days before the next refresh PR merges, and the runtime fallback covers that gap invisibly. Without it, Phase 2's cadence would have to be sub-hourly.

## What didn't — surprises from the build log

Four things bit during Phase 1 that the design didn't predict. Each is one of those "smells in retrospect, not at the time" moments worth keeping.

**1. The script had to be `.mts`, not `.ts`.** The repo root `package.json` has no `"type": "module"`, so `tsx` defaults to CJS interpretation per file. Top-level `await` and `import.meta.url` — both used by the script — fail under CJS. Renaming the file to `.mts` forces ESM per-file without touching the rest of the repo's interpretation. **Lesson:** in a monorepo with mixed module modes, `.mts` / `.cts` are extension-as-config and avoid blast radius on `package.json` edits.

**2. Native deps (`sharp`, `blurhash`, `tsx`) live at the workspace root.** First attempt put them in `apps/web` since that's where the assets are consumed. pnpm hoisting was unreliable for `sharp`'s native binary, and the script (at root) couldn't resolve it at runtime under some node-modules layouts. Co-locating the deps with the script that uses them — at root — was the only stable arrangement. **Lesson:** native binaries + pnpm = pin the resolver by colocating, don't trust hoisting.

**3. The consistency assertion that re-derived the path it was checking.** The first refresh-script run wrote 6 MB of WebPs to `apps/web/lol/` instead of `apps/web/public/lol/`. `path.join(root, "apps/web", "/lol/x")` silently drops `public/` because the leading slash on the second arg makes it absolute. The script's own "every manifest URL has a file on disk" assertion missed it — because the assertion re-derived the disk path *using the same buggy join*, so the assertion's check and the bug were both wrong in the same direction. Caught by `du -sh` on the expected output dir. **Lesson:** an assertion that re-computes the thing it's verifying isn't an assertion. The manifest URL and the disk path need a single named mapping helper (`urlPathToDiskPath`) so the assertion can hold the mapping accountable instead of duplicating it.

**4. CDragon's `/latest/` URLs make patch-bumps invalidate every cached entry.** CDragon serves "whatever the current patch is" with no version key — there's no ETag or content-version negotiation. If the patch changed underneath us, every cached entry in `.cache/lol-images/` is potentially stale and re-deriving incremental skip decisions from `previous manifest.patch === current` would silently keep old data. The script handles this by treating a patch-bump as an implicit `--full`, dropping all skips for that run. It's a sledgehammer but it's the only correct option without per-source ETags. **Lesson:** incremental refresh needs an honest "I can't tell if this is stale" mode. Don't fake confidence with stale heuristics.

## Open questions

Things deliberately deferred but worth watching:

- **Playwright visual smoke test.** Currently `verify:cc` (typecheck + lint + unit tests) is the only PR gate. It catches schema/import-shape breakages but not, say, a champion icon rendering as 1×1 pixels because the manifest entry points at a corrupted WebP. The hash check on download partly mitigates this — a corrupted source would change the hash and trigger an `updated` diff — but it wouldn't catch encoder pathologies. If we see a regression, a 30-line Playwright test that loads `/profile/foo` and asserts every visible `<img>` has `naturalWidth > 0` is the right shape. Until we see one, it's deferred — adding a Playwright dep + browser in CI to guard against a hypothetical isn't worth it on a solo project.
- **Profile icons.** ~6000 in-game icons with sparse usage. Bundling is unbounded vs. usage, so the runtime fallback (wsrv.nl + Phase 0 timeout) is the right tool for that long tail. Worth revisiting if profile-icon usage concentrates somewhere — caching the top N seen in DB could give 99% bundle-hit at a fraction of the bytes.
- **Per-locale variants.** Out of scope — we render en_US only. The manifest schema is keyed in a way that supports `locale` extension; if localization happens, the script grows but the URL helpers don't.
- **PBE patch tracking.** Out of scope — too noisy. Patch detection deliberately uses the live `versions.json`, not the PBE endpoint.

## Future work

**Phase 3 — service worker.** Scoped in [the working note](../working-notes/lol-image-pipeline.md#phase-3--service-worker-polish-defer) but deferred. The bundled `/lol/**` paths already get strong cache headers from every hosting option we'd pick, so the SW would primarily benefit the long-tail runtime fallback URLs (the wsrv.nl chain). That's a real benefit — offline-capable thumbnails after first visit — but it's polish, not a pain reliever. Worth ~150 LOC if we ever want the portfolio bullet. Cache-first with stale-while-revalidate on `/lol/**` and the long-tail CDN URLs; the standard `skipWaiting` + `clientsClaim` foot-gun applies.

**Hosting CSP.** When we land an explicit `Content-Security-Policy` header at the hosting layer, `img-src` needs to permit `https://wsrv.nl`, `https://cdn.communitydragon.org`, `https://ddragon.leagueoflegends.com`, plus `'self'`. The runtime fallback chain depends on it; today there's no policy header and direct `<img>` tags don't need fetch-policy permission.

**Backend image proxy.** Originally framed as the architecturally "proper" answer — Nest controller + Sharp + R2/S3. Replaced by Phase 1 (build-time prefetch). The proxy framing is overkill for a portfolio app's actual needs once self-hosting is in place. Kept as a parked design in [lol-image-pipeline.md](../working-notes/lol-image-pipeline.md#backend-image-proxy) because it's the right answer for a different problem — user uploads, dynamic transforms, unbounded asset handling — and worth referencing if a future project needs it.

## Cost / benefit

| | Before | After |
|---|---|---|
| External image requests, cold profile load | ~210 (wsrv.nl) | 0 for any bundled asset |
| Worst-case render wait on a hung probe | unbounded | ~6s (Phase 0 timeout) |
| Bundle size delta | — | +9.7 MB (one-time, ~few KB per patch after) |
| Manual work per Riot patch | run script + commit + push | open auto-PR, hit merge (or auto-merge for additive) |
| Lines of code touched | — | ~700 (script) + ~80 (URL helpers) + ~80 (workflow) |

The three phases sit naturally on top of each other and don't depend on one being clever to make the next work. Phase 0 makes Phase 1 unhurried. Phase 1 makes Phase 2 cheap (the manifest is the diffing primitive). Phase 2 makes Phase 0 nearly irrelevant — but Phase 0 is still the thing that makes the long-tail fallback safe.

## Connections

- [build-time-champion-assets.md](./build-time-champion-assets.md) — the older case study on theme palette + blurhash extraction. The Phase 1 refresh script supersedes its `tools/champion-assets/` workspace by running theme/blurhash regeneration in the same pass; the two pipelines can never desync now.
- [frontend-perf.md](./frontend-perf.md) — broader frontend perf arc this fits into.
- [lol-image-pipeline.md](../working-notes/lol-image-pipeline.md) — the working note this case study summarizes. Build log, parked options, and failure-mode table live there.
