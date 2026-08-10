import { API_PUBLIC_URL } from "@/lib/api-url";
import { SITE_URL } from "@/lib/site-url";
import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SHADOW_LABEL } from "./chapter-shadows";

/** The two chapters with a share card behind `GET /og/recap/:chapter.png`. */
export type ShareableChapter = "champion" | "conclusion";

type ShareState = "idle" | "busy" | "shared" | "copied" | "saved";

// The verb doubles as the accessible name, so each outcome names what
// actually happened — "Copied" after a clipboard write is a different
// promise than "Shared" after the OS share sheet.
const LABELS: Record<ShareState, string> = {
  idle: "Share",
  busy: "Share",
  shared: "Shared",
  copied: "Copied",
  saved: "Saved",
};

const RESET_DELAY_MS = 2500;

async function fetchCardBlob(chapter: ShareableChapter): Promise<Blob> {
  const res = await fetch(`${API_PUBLIC_URL}/og/recap/${chapter}.png`);
  if (!res.ok) throw new Error(`og card fetch → HTTP ${res.status}`);
  return res.blob();
}

/**
 * Per-chapter share affordance for the flagship recap chapters on `/`.
 * Fetches the chapter's OG card and hands it to the richest channel the
 * browser offers: the Web Share sheet with the PNG attached, else an
 * image clipboard write, else a plain download. The link travels in the
 * share `text` rather than a `url` field — url-plus-files payloads fail
 * `canShare` on several platforms while text always rides along.
 *
 * Styled for the chapter eyebrow row: inherits the row's uppercase
 * tracking, sits behind the same `·` divider as the other kickers.
 */
export function ChapterShareButton({
  chapter,
  title,
}: {
  chapter: ShareableChapter;
  title: string;
}) {
  const [state, setState] = useState<ShareState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const settle = (outcome: ShareState) => {
    setState(outcome);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), RESET_DELAY_MS);
  };

  const handleShare = async () => {
    if (state === "busy") return;
    setState("busy");
    let blob: Blob;
    try {
      blob = await fetchCardBlob(chapter);
    } catch {
      // A failed card fetch has nothing to hand any channel: return the
      // affordance quietly rather than growing an error state the eyebrow
      // row has no room for.
      setState("idle");
      return;
    }

    // A ladder, not a switch: each channel that exists gets a try, and a
    // channel *failing* (share sheet erroring, clipboard permission denied)
    // falls through to the next. The one deliberate stop is the user
    // dismissing the share sheet — an AbortError is a choice, and answering
    // it with a surprise download would override that choice.
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
        settle("shared");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState("idle");
          return;
        }
      }
    }
    if (
      typeof ClipboardItem !== "undefined" &&
      typeof navigator.clipboard?.write === "function"
    ) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        settle("copied");
        return;
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
    settle("saved");
  };

  const done = state === "shared" || state === "copied" || state === "saved";
  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex cursor-pointer items-center gap-1.5 text-foreground/60 transition-colors hover:text-foreground/90"
      style={{ textShadow: SHADOW_LABEL }}
    >
      {done ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Share2 aria-hidden="true" className="size-3.5" />
      )}
      <span aria-live="polite">{LABELS[state]}</span>
    </button>
  );
}
