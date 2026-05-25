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

export function GameAboutBlock({ appid }: { appid: number }) {
  const { data, isPending, isError } = useGameDescription(appid);
  const html = useRenderedDescription(data?.bbcode ?? null);

  if (isPending) {
    return (
      <section aria-busy className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-foreground/10" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-foreground/10" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-foreground/10" />
      </section>
    );
  }

  // Network error or empty description (no enrichment row, DLC/bundle, etc.)
  // both render as "no block at all" — there's no editorial value in a
  // placeholder, and the block is one of several on the page.
  if (isError || !html) return null;

  // Card chrome (`rounded-lg border bg-card/50 p-4`) matches the sibling
  // sections on the game-detail page (unlock timeline, verdict cards,
  // achievement panel). Heading style mirrors the same convention —
  // small-caps muted-foreground subhead — so the page reads as a stack of
  // uniform cards rather than a mix of bare blocks and chromed ones.
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        About this game
      </h2>
      <div
        className="prose prose-sm max-w-none text-foreground/85 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_ul]:my-2"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised via sanitizeRichHtml; img dropped
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
