import { bbcodeToHtml, sanitizeRichHtml } from "@vyoh/shared";
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

// Render order: raw BBCode → bbcodeToHtml (Steam dialect → tagged HTML) →
// sanitizeRichHtml (LoL trust-boundary pipeline → safe HTML) → React via
// `dangerouslySetInnerHTML`. Both layers are pure and run on each render —
// the source rarely changes (cron updates the column on content patches), so
// memoise so re-renders during scroll / route transitions are free.
function useRenderedDescription(bbcode: string | null): string | null {
  return useMemo(() => {
    if (!bbcode) return null;
    const html = bbcodeToHtml(bbcode);
    const safe = sanitizeRichHtml(html, { rewriteImgSrc: rewriteImgSrcDrop });
    return safe.length > 0 ? safe : null;
  }, [bbcode]);
}

// Inline-prose About block. The wrapper section + h2 + card chrome that the
// previous standalone version carried have been removed — this block is now
// rendered inside the game-detail identity card, behind a "Read full
// description" toggle, so the page-level chrome is owned by the parent
// (identity card) and the toggle button doubles as the section header.
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
export function GameAboutBlock({ appid }: { appid: number }) {
  const { html, isPending } = useGameDescriptionHtml(appid);

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

  return (
    <div
      className="prose prose-sm max-w-none text-foreground/85 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_ul]:my-2"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised via sanitizeRichHtml; img dropped
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Companion hook the parent uses to decide whether to render the toggle at
// all. Returns `hasDescription` (true once we know there's a non-empty
// sanitised body), `isPending`, and the rendered HTML so the parent doesn't
// have to re-run the BBCode pipeline. Single source of truth for "does this
// game have a renderable About block."
export function useGameDescriptionHtml(appid: number): {
  html: string | null;
  isPending: boolean;
  hasDescription: boolean;
} {
  const { data, isPending, isError } = useGameDescription(appid);
  const html = useRenderedDescription(data?.bbcode ?? null);
  return {
    html: isError ? null : html,
    isPending,
    hasDescription: !!html,
  };
}
