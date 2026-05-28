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
      root.style.setProperty(
        "--theme-grad-from",
        `oklch(from ${color} calc(l + 0.15) c calc(h - 10))`
      );
      root.style.setProperty(
        "--theme-grad-mid",
        `oklch(from ${color} calc(l + 0.22) calc(c - 0.04) calc(h - 15))`
      );
      root.style.setProperty(
        "--theme-grad-to",
        `oklch(from ${color} calc(l + 0.15) calc(c - 0.03) calc(h - 40))`
      );
      if (meta) meta.content = color;
    } else {
      root.style.removeProperty("--theme-color");
      root.style.removeProperty("--theme-grad-from");
      root.style.removeProperty("--theme-grad-mid");
      root.style.removeProperty("--theme-grad-to");
    }

    return () => {
      root.style.removeProperty("--theme-color");
      root.style.removeProperty("--theme-grad-from");
      root.style.removeProperty("--theme-grad-mid");
      root.style.removeProperty("--theme-grad-to");
      if (meta && previousMeta !== undefined) meta.content = previousMeta;
    };
  }, [color]);
}
