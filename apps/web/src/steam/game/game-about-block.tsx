import {
  bbcodeToHtml,
  sanitizeRichHtml,
  stripLeadingOverlapWithShort,
} from "@vyoh/shared";
import { useMemo } from "react";
import { useGameDescription } from "./use-game-description";

// `<img>` policy: drop all inline images for now. Steam descriptions embed
// publisher screenshots/logos via raw `steamcdn-a.akamaihd.net` URLs, which
// would either leak the upstream into the browser (no caching, no transcode)
// or require a generic image proxy endpoint that doesn't yet exist. The
// editorial intent of the "About this game" block is the text content;
// screenshots ship in their own strip (Chunk 9). When the generic proxy
// lands, swap the `rewriteImgSrc` to route through it.
function rewriteImgSrcDrop(): null {
  return null;
}

// Render order: raw BBCode → stripLeadingOverlapWithShort (drop opening
// lines that paraphrase the short description, so the expanded view doesn't
// duplicate the always-visible summary) → bbcodeToHtml (Steam dialect →
// tagged HTML) → sanitizeRichHtml (LoL trust-boundary pipeline → safe
// HTML) → React via `dangerouslySetInnerHTML`. All layers are pure and run
// on each render — the source rarely changes (cron updates the column on
// content patches), so memoise so re-renders during scroll / route
// transitions are free. The overlap strip is a best-effort heuristic; for
// games where the short is a standalone tagline (no overlap) it no-ops.
function useRenderedDescription(
  bbcode: string | null,
  shortDescription: string | null
): string | null {
  return useMemo(() => {
    if (!bbcode) return null;
    const trimmed = stripLeadingOverlapWithShort(bbcode, shortDescription);
    if (!trimmed) return null;
    const html = bbcodeToHtml(trimmed);
    const safe = sanitizeRichHtml(html, { rewriteImgSrc: rewriteImgSrcDrop });
    return safe.length > 0 ? safe : null;
  }, [bbcode, shortDescription]);
}

// Inline-prose About block. The wrapper section + h2 + card chrome that the
// previous standalone version carried have been removed — this block is now
// rendered inside the game-detail identity card, behind a "Read full
// description" toggle, so the page-level chrome is owned by the parent
// (identity card) and the toggle button doubles as the section header.
//
// `shortDescription` is the always-visible summary above this block in the
// identity card; the renderer uses it to drop leading paragraphs of the
// full body that duplicate it (see `stripLeadingOverlapWithShort`). Pass
// `null` to skip the dedup pass entirely.
//
// Loading / error / empty branches:
//   - loading: a small inline skeleton (3 lines)
//   - error / empty: null (the parent toggle stays clickable but expanding
//     reveals only a one-line "no description on file" hint, kept out of
//     this component because the parent decides how to message that)
//
// `data` is exposed via a sibling `useGameDescriptionHtml` hook so the
// parent can decide whether to even render the toggle (no description ⇒
// no toggle).
export function GameAboutBlock({
  appid,
  shortDescription,
}: {
  appid: number;
  shortDescription: string | null;
}) {
  const { html, isPending } = useGameDescriptionHtml(appid, shortDescription);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy>
        <div className="h-4 w-full animate-pulse rounded bg-foreground/10" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-foreground/10" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-foreground/10" />
      </div>
    );
  }

  if (!html) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No full description on file for this game.
      </p>
    );
  }

  // Explicit typography rules instead of `prose prose-sm` — Tailwind v4
  // here ships without `@tailwindcss/typography`, so the `prose` classes
  // are no-ops and headings fall back to browser defaults (huge `<h1>`,
  // base 16px `<p>`), reading as a jarring size jump from the surrounding
  // `text-sm` short description. Body text matches the short description
  // exactly (`text-sm text-muted-foreground`) so the expansion looks like
  // "more of the same paragraph", not a separate document.
  return (
    <div
      className="text-sm text-muted-foreground [&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground/85 [&_h1:first-child]:mt-0 [&_h2]:mt-3 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-foreground/70 [&_h2:first-child]:mt-0 [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground/85 [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:text-foreground/90 [&_ul]:my-2"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised via sanitizeRichHtml; img dropped
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Companion hook the parent uses to decide whether to render the toggle at
// all. Returns `hasDescription` (true once we know there's a non-empty
// sanitised body AFTER the overlap-with-short strip — if the short
// description already covers the entire full body, the toggle would expand
// to empty text, so we suppress it here), `isPending`, and the rendered
// HTML so the parent doesn't have to re-run the BBCode pipeline.
export function useGameDescriptionHtml(
  appid: number,
  shortDescription: string | null
): {
  html: string | null;
  isPending: boolean;
  hasDescription: boolean;
} {
  const { data, isPending, isError } = useGameDescription(appid);
  const html = useRenderedDescription(data?.bbcode ?? null, shortDescription);
  return {
    html: isError ? null : html,
    isPending,
    hasDescription: !!html,
  };
}
