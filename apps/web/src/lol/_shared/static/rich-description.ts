import { rewriteWikiImageSrc } from "@/lol/_shared/assets/champion-icon";
import { sanitizeRichHtml } from "@vyoh/shared";

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
  const out = sanitizeRichHtml(rawHtml, { rewriteImgSrc: rewriteWikiImageSrc });
  return out.length > 0 ? out : null;
}
