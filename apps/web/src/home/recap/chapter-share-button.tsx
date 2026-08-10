import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SHADOW_LABEL } from "./chapter-shadows";
import { type ShareableChapter, shareChapterCard } from "./share-chapter-card";

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

/**
 * Per-chapter share affordance for the flagship recap chapters on `/`.
 * Hands the click to the `shareChapterCard` ladder and reports the
 * outcome in place.
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
    const outcome = await shareChapterCard(chapter, title);
    if (outcome === "failed" || outcome === "dismissed") {
      // A failed fetch has nothing to hand any channel, and a dismissed
      // sheet was the user's call — both land back on the idle label
      // rather than growing an error state the eyebrow row has no room for.
      setState("idle");
      return;
    }
    settle(outcome);
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
