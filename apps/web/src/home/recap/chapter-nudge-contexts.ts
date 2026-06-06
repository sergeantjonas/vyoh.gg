import { createContext, useContext } from "react";

/**
 * Chapter-level nudge — `true` once the chapter (multi-beat or single-pin)
 * has entered the user's view. Drives the persistent title card's
 * blur-rise cascade so the masthead animates once on chapter entry, not
 * on every re-render or beat transition.
 *
 * Lives here (rather than colocated with `ChapterMultiBeat`) because both
 * the chapter wrapper that provides it and the consumers that read it
 * are in different files; a shared module avoids an import cycle. The
 * context name kept the "Group" prefix from the legacy `ChapterGroup`
 * primitive (deleted in 3g cleanup) — semantically it means "chapter
 * entered", just preserved across the rename to minimise downstream
 * churn.
 */
export const ChapterGroupNudgeContext = createContext(false);

export function useChapterGroupNudge(): boolean {
  return useContext(ChapterGroupNudgeContext);
}

/**
 * Per-beat nudge — `true` once this beat has scrolled into its active
 * range within the chapter's scroll timeline. Drives the `ChapterReveal`
 * cascade in the beat's children so each beat's editorial reveal plays
 * when it becomes dominant, not at chapter mount.
 *
 * Set by `MultiBeat` (in `multi-beat.tsx`) via the per-beat `useInView`
 * observation against the main scroll container.
 */
export const ChapterBeatNudgeContext = createContext(false);

export function useChapterBeatNudge(): boolean {
  return useContext(ChapterBeatNudgeContext);
}
