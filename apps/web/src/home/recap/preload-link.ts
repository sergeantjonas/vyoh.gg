/**
 * Inject a `<link rel="preload" as="image">` for `href` onto `document.head`.
 *
 * Used for critical-path chapter hero assets (the first two chapters in the
 * recap stream). Browsers honor `rel="preload"` earlier than an
 * `Image()` constructor — the link enters the preload queue immediately,
 * while a script-created `Image` waits until the script that creates it
 * has run. For above-the-fold and just-below-the-fold chapter assets,
 * that head start is the difference between "asset in cache when chapter
 * pins" and "asset still streaming when chapter pins."
 *
 * Idempotent: if a link with the same `href` and `rel="preload"` is
 * already present, this is a no-op. Returns a cleanup function that
 * removes only the link this call inserted (not pre-existing duplicates).
 * `null` / `undefined` `href` is a no-op that returns a no-op cleanup.
 *
 * Lazy chapters use `useAssetPreload` instead — viewport-proximity
 * gating, no critical-path budget impact.
 */
export function preloadLinkAsImage(href: string | null | undefined): () => void {
  if (typeof document === "undefined" || !href) return () => {};
  const existing = document.head.querySelector(
    `link[rel="preload"][href="${CSS.escape(href)}"]`
  );
  if (existing) return () => {};
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  document.head.appendChild(link);
  return () => {
    if (link.parentNode) link.parentNode.removeChild(link);
  };
}
