import { useEffect } from "react";

const META_SELECTOR = 'meta[name="theme-color"]';

/**
 * Drives the per-entity `--theme-color` token on `<html>` and the mobile
 * browser-chrome `<meta name="theme-color">` for the current route. Pass a
 * CSS color (hex, oklch, etc.); pass `null` to clear and fall back to the
 * default declared in index.css.
 */
export function useThemeColor(color: string | null | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>(META_SELECTOR);
    const previousMeta = meta?.content;
    // Capture the inline --theme-color (NOT the computed value — we only
    // want to restore an explicit prior override, not the CSS fallback in
    // index.css). Restoring on unmount lets a panel call this hook to
    // override the page's claimed theme color for its lifetime, and the
    // previously-claimed color comes back when the panel closes — without
    // forcing the parent claimant to re-run any effect.
    const previousVar = root.style.getPropertyValue("--theme-color");

    if (color) {
      root.style.setProperty("--theme-color", color);
      if (meta) meta.content = color;
    } else {
      root.style.removeProperty("--theme-color");
    }

    return () => {
      if (previousVar) {
        root.style.setProperty("--theme-color", previousVar);
      } else {
        root.style.removeProperty("--theme-color");
      }
      if (meta && previousMeta !== undefined) meta.content = previousMeta;
    };
  }, [color]);
}
