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

    if (color) {
      root.style.setProperty("--theme-color", color);
      if (meta) meta.content = color;
    } else {
      root.style.removeProperty("--theme-color");
    }

    return () => {
      root.style.removeProperty("--theme-color");
      if (meta && previousMeta !== undefined) meta.content = previousMeta;
    };
  }, [color]);
}
