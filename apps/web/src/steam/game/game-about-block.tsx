import { CardTitle } from "@/components/ui/card-title";
import { bbcodeToHtml, sanitizeRichHtml } from "@vyoh/shared";
import { useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { rewriteSteamDescriptionAssetUrl } from "../_shared/steam-image";
import { useGameDescription } from "./use-game-description";

// Editorial cap on rendered media (videos + standalone images, combined).
// Some publishers staple 6–8 gameplay clips into about-the-game; rendering
// them all turns the card into a promo reel and competes for attention with
// the rest of the page. Five strikes a balance — enough to feel rich, not so
// many that the section dominates.
const MEDIA_RENDER_CAP = 5;

// Post-sanitiser editorial polish. Three passes over the rendered DOM tree:
//
// 1. **Reduced motion**: each `<video>` with a `poster` becomes a `<img>`
//    pointing at the poster. WebM never gets downloaded — saves bandwidth
//    and battery without losing the editorial frame. Videos without a poster
//    are removed entirely under reduce-motion (no graceful fallback exists).
// 2. **Lazy attrs**: `<img loading="lazy" decoding="async">` for every image
//    so the card doesn't block layout; `<video preload="metadata">` so the
//    WebM bytes aren't eagerly fetched (browser pulls them on play/scroll).
// 3. **Render cap**: count combined media elements, drop anything past the
//    cap. The first N are typically the editorial highlights publishers
//    care about; the long tail is decorative spacers and screenshot dumps.
//
// DOMParser is used over regex because the input has nested structure
// (`<video><source></video>`) and attribute order matters less than
// structural fidelity. happy-dom supports DOMParser in tests.
function postProcessAboutHtml(
  html: string,
  opts: { reduceMotion: boolean; maxMedia: number }
): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;

  if (opts.reduceMotion) {
    for (const video of Array.from(root.querySelectorAll("video"))) {
      const poster = video.getAttribute("poster");
      if (poster) {
        const img = doc.createElement("img");
        img.setAttribute("src", poster);
        img.setAttribute("alt", "");
        const w = video.getAttribute("width");
        const h = video.getAttribute("height");
        if (w) img.setAttribute("width", w);
        if (h) img.setAttribute("height", h);
        video.replaceWith(img);
      } else {
        video.remove();
      }
    }
  }

  for (const img of Array.from(root.querySelectorAll("img"))) {
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
  }
  for (const video of Array.from(root.querySelectorAll("video"))) {
    video.setAttribute("preload", "metadata");
  }

  const media = Array.from(root.querySelectorAll("video, img"));
  for (const el of media.slice(opts.maxMedia)) el.remove();

  return root.innerHTML;
}

// Render order, preferred path: rendered `about_the_game` HTML from Steam's
// storefront → sanitizeRichHtml with `allowVideo: true` → React via
// `dangerouslySetInnerHTML`. Content-hashed `extras/<hash>.{webm,poster.avif}`
// URLs (the only path to Steam's inline gameplay clips) route through the
// project's description-asset proxy; any non-extras URL is dropped to keep
// raw upstreams out of the browser. Steam emits both `<img>` and `<video>`
// inside about-the-game, so the same rewriter feeds both attribute hooks.
//
// Fallback path: monthly-enriched BBCode rendered through bbcodeToHtml + the
// img-drop policy. Used while the lazy `aboutTheGameHtml` fetch is in flight,
// when the storefront fetch failed transiently, and for delisted titles where
// Steam emits no about-block (html === ""). BBCode survival keeps the card
// from disappearing on the first cold view.
function useRenderedDescription(
  html: string | null,
  bbcode: string | null,
  reduceMotion: boolean
): string | null {
  return useMemo(() => {
    if (html && html.length > 0) {
      const safe = sanitizeRichHtml(html, {
        allowVideo: true,
        rewriteImgSrc: rewriteSteamDescriptionAssetUrl,
        rewriteVideoUrl: rewriteSteamDescriptionAssetUrl,
      });
      if (safe.length > 0) {
        return postProcessAboutHtml(safe, {
          reduceMotion,
          maxMedia: MEDIA_RENDER_CAP,
        });
      }
    }
    if (!bbcode) return null;
    const fromBb = bbcodeToHtml(bbcode);
    const safe = sanitizeRichHtml(fromBb, { rewriteImgSrc: () => null });
    return safe.length > 0 ? safe : null;
  }, [html, bbcode, reduceMotion]);
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
  const reduceMotion = useReducedMotion() === true;
  const html = useRenderedDescription(
    data?.html ?? null,
    data?.bbcode ?? null,
    reduceMotion
  );

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
      <CardTitle as="h2">About this game</CardTitle>
      <div
        className="text-sm text-muted-foreground [&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground/85 [&_h1:first-child]:mt-0 [&_h2]:mt-3 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-foreground/70 [&_h2:first-child]:mt-0 [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground/85 [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:text-foreground/90 [&_ul]:my-2 [&_video]:my-2 [&_video]:h-auto [&_video]:max-w-full [&_video]:rounded"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised via sanitizeRichHtml with video/img allowlist + proxy rewriters
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
