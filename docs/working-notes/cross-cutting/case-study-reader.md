# Case-study reader — in-app `/writing` surface

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Promote to Active with a chunk plan + open-work entry when picked. No hard dependency; SEO payoff is larger after the TanStack Start migration.

## Why

[docs/case-studies/](../../case-studies/) holds **21 finished public write-ups** (rate limits, frontend perf, motion without gimmicks, Satori OG cards, face-aware library rows, …) with zero distribution — they're only readable by someone already browsing the repo. A prospective freelance client lands on the *site*, not the repo. Surfacing the write-ups in-app is the missing last mile for the entire case-study effort, and it's the highest value-to-effort item in the idea pool: the content exists, only the reader needs building.

## Shape

- **Route:** `/writing` (own top-level section: index page + `/writing/$slug` detail). Becomes a section → section root calls `useScrollResetOnNav` with a list↔detail skip pair per the [scroll convention](../../repo-conventions.md#scroll-to-top-is-layered-between-root-and-section-roots).
- **Pipeline:** build-time import of `docs/case-studies/*.md` (Vite glob + frontmatter), not a CMS and not runtime fetching. The studies stay canonical in `docs/` — the app renders them, never forks them.
- **Code blocks:** `shiki` — this is exactly the parked trigger recorded in [library-shortlist.md](library-shortlist.md) ("API explorer or case-study inline code"). Build-time highlighting, zero client JS.
- **Typography:** the editorial treatment is the showcase here — `SectionTitle`/`EditorialHeading` vocabulary, measure-capped prose, generous whitespace. A reader that looks like a default markdown dump undercuts the point.
- **Per-study OG cards:** the Satori pipeline ([og-image-pipeline.md](og-image-pipeline.md)) already does per-route cards; add a `writing/$slug` variant.
- **Palette:** `read <topic>` / study search grammar in the same change per the [palette convention](../../repo-conventions.md#extend-the-command-palette-when-adding-filterable-surfaces).
- **Cross-links:** each study links to the live surface it describes ("see it running →"), and surfaces can link back ("how this was built"). That bidirectional weave — every feature ships with its own engineering story — is the differentiator no template portfolio has.

## Sequencing / dependencies

- Ships any time; content maintenance is zero (studies are written as arcs land — standing practice).
- SEO for long-form prose is the strongest argument on file for the [Start/SSR migration](tanstack-start-migration.md); consider sequencing the reader right after the route-loader pilot so the studies render server-side from day one.

## Risks / open questions

- **Tone check before exposure:** studies were written public-facing per [../README.md](../README.md), but do one editorial pass for repo-internal links/paths that won't resolve for an outside reader (rewrite to GitHub URLs at build time).
- Route name `/writing` vs `/case-studies`: `/writing` reads editorial, `/case-studies` reads portfolio-SEO. Decide at scoping.
- Don't add MDX (runtime components inside prose) until a study actually needs an embedded live demo — plain markdown + shiki covers all 21 today.
