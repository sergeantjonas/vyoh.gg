import { useEffect } from "react";
import { useAudio } from "./use-audio";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Global Shift+M shortcut to toggle UI sound. Skipped while typing.
 * Mount once at app root alongside `useAudioHydration`.
 */
export function useAudioShortcut(): void {
  const { enabled, setEnabled, play } = useAudio();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || !e.shiftKey) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      const next = !enabled;
      setEnabled(next);
      if (next) play("palette.select");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, setEnabled, play]);
}
