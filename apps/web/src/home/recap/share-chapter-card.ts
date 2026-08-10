import { API_PUBLIC_URL } from "@/lib/api-url";
import { SITE_URL } from "@/lib/site-url";

/** The two chapters with a share card behind `GET /og/recap/:chapter.png`. */
export type ShareableChapter = "champion" | "conclusion";

// How the card left the app — or didn't. "dismissed" is the user closing
// the share sheet; "failed" is the card fetch coming back empty-handed.
export type ShareOutcome = "shared" | "copied" | "saved" | "dismissed" | "failed";

async function fetchCardBlob(chapter: ShareableChapter): Promise<Blob> {
  const res = await fetch(`${API_PUBLIC_URL}/og/recap/${chapter}.png`);
  if (!res.ok) throw new Error(`og card fetch → HTTP ${res.status}`);
  return res.blob();
}

/**
 * Fetches the chapter's OG card and hands it to the richest channel the
 * browser offers: the Web Share sheet with the PNG attached, else an
 * image clipboard write, else a plain download. The link travels in the
 * share `text` rather than a `url` field — url-plus-files payloads fail
 * `canShare` on several platforms while text always rides along.
 *
 * A ladder, not a switch: each channel that exists gets a try, and a
 * channel *failing* (share sheet erroring, clipboard permission denied)
 * falls through to the next. The one deliberate stop is the user
 * dismissing the share sheet — an AbortError is a choice, and answering
 * it with a surprise download would override that choice.
 */
export async function shareChapterCard(
  chapter: ShareableChapter,
  title: string
): Promise<ShareOutcome> {
  let blob: Blob;
  try {
    blob = await fetchCardBlob(chapter);
  } catch {
    return "failed";
  }

  const file = new File([blob], `vyoh-recap-${chapter}.png`, {
    type: "image/png",
  });
  const payload = { files: [file], title, text: SITE_URL };
  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare(payload)
  ) {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "dismissed";
      }
    }
  }
  if (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  ) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    } catch {
      // Permission denied or unsupported payload — the download below
      // needs neither.
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
  return "saved";
}
