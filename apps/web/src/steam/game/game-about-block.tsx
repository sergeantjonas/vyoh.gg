import { bbcodeToHtml, sanitizeRichHtml } from "@vyoh/shared";
import { useMemo } from "react";
import { useGameDescription } from "./use-game-description";

// `<img>` policy: drop all inline images for now. Steam descriptions embed
// publisher screenshots/logos via raw `steamcdn-a.akamaihd.net` URLs, which
// would either leak the upstream into the browser (no caching, no transcode)
// or require a generic image proxy endpoint that doesn't yet exist. The
// editorial intent of the "About this game" block is the text content;
// screenshots ship in their own strip. When the generic proxy lands, swap
// the `rewriteImgSrc` to route through it.
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

// Standalone "About this game" card. Lives in its own band on the
// game-detail page — physically separated from the identity card's short
// description by the screenshot strip. The visual distance is the
// dedup strategy: short and full will still overlap content-wise for some
// publishers (Steam's short is often a condensation of the opening
// paragraphs), but with the screenshot strip between them the eye doesn't
// pattern-match the duplication. Earlier attempts at heuristic and
// verbatim-sentence stripping all created their own gotchas — separation
// is the more robust answer.
//
// Loading / error / empty branches:
//   - loading: skeleton card with the same chrome (no layout shift)
//   - error / empty (DLC / bundle / demo with no description): null (the
//     entire card is hidden so an empty box doesn't reserve space)
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

  if (isError || !html) return null;

  // Card chrome matches the sibling sections on the page (verdict cards,
  // unlock timeline, achievement panel). Body typography matches the
  // identity card's short description (`text-sm text-muted-foreground`) so
  // the two descriptions read as the same voice, just at different
  // detail levels.
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        About this game
      </h2>
      <div
        className="text-sm text-muted-foreground [&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground/85 [&_h1:first-child]:mt-0 [&_h2]:mt-3 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-foreground/70 [&_h2:first-child]:mt-0 [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground/85 [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:text-foreground/90 [&_ul]:my-2"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised via sanitizeRichHtml; img dropped
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
