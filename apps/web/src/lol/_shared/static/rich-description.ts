import { rewriteWikiImageSrc } from "@/lol/_shared/assets/champion-icon";
import { sanitizeRichHtml } from "@vyoh/shared";

// Wiki's `{{ft|long|short}}` template emits both arms with bracket padding
// and toggles visibility with a `.active` class:
//   <span class="flipText1 active">「&nbsp;long&nbsp;」</span>
//   <span class="flipText2">「&nbsp;short&nbsp;」</span>
// Our tooltips don't ship wiki's accompanying toggle script, so without
// intervention the user sees `「 long 」「 short 」`. Strip the inactive arm
// entirely and unwrap the active one to its inner text minus the bracket
// padding, before sanitisation so the cleanup lives in one place.
const FLIP_SHORT = /<span class="flipText2[^"]*">[\s\S]*?<\/span>/g;
const FLIP_LONG =
  /<span class="flipText1[^"]*">\s*「(?:&#160;|&nbsp;| |\s)*([\s\S]*?)(?:&#160;|&nbsp;| |\s)*」\s*<\/span>/g;

function unwrapFlipTemplate(html: string): string {
  return html.replace(FLIP_SHORT, "").replace(FLIP_LONG, "$1");
}

// Turns wiki `action=parse` HTML into safe, image-proxied HTML suitable for
// `dangerouslySetInnerHTML`. The wiki→proxy rewrite for inline `<img>` icons
// is bound here so callers don't reach for the champion-icon helper
// themselves — `toRichDescription` is the only place tooltip surfaces should
// touch when wiring rich content from a `descriptionHtml` field.
//
// Returns `null` when the input is empty or the sanitiser strips it to
// nothing (e.g. all-disallowed-tags). Consumers should branch on null/non-null
// to decide between rich rendering and plain-text fallback.
export function toRichDescription(rawHtml: string | null | undefined): string | null {
  if (!rawHtml) return null;
  const out = sanitizeRichHtml(unwrapFlipTemplate(rawHtml), {
    rewriteImgSrc: rewriteWikiImageSrc,
  });
  return out.length > 0 ? out : null;
}
