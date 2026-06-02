import { mainScrollRef } from "@/lib/scroll-container";
import { type RefObject, useEffect } from "react";

/**
 * IntersectionObserver `rootMargin` for the preload trigger. 50% of the
 * viewport height ahead of the chapter — wide enough that a fast scroll
 * still resolves the fetch before the chapter pins, narrow enough that
 * chapters far below the fold don't all start fetching on mount.
 *
 * Earlier prefetch sites (pre-R-9) fired `new Image()` unconditionally on
 * chapter mount. With the algorithmic chapter stream now mounting K
 * chapters at once, that pattern would race the critical-path hero
 * assets. This hook gates the fetch by viewport proximity instead.
 */
const PRELOAD_ROOT_MARGIN = "50%";

/**
 * Just-in-time image-asset preloader for recap chapters. Watches `ref`
 * via IntersectionObserver and fires `new Image()` for each URL once the
 * referenced element enters the rootMargin-expanded viewport.
 *
 * Behavior:
 * - One-shot per URL: once a URL is preloaded, it's not re-fetched even
 *   if the element re-enters the viewport.
 * - URL changes mid-life: a URL that wasn't in the previous render's set
 *   gets preloaded on the next intersection.
 * - `null` / `undefined` URLs in the array are filtered out (caller can
 *   pass conditional URLs without pre-filtering).
 * - SSR / no-IO fallback: when `IntersectionObserver` is undefined
 *   (happy-dom tests pre-shim, Node SSR), all URLs preload immediately —
 *   mirroring `useChapterNudge`'s no-IO fallback (treat the chapter as
 *   already-engaged rather than never-engaged).
 *
 * Pairs with `preloadLinkAsImage` for critical-path chapters (the first
 * two in the stream): those inject a `<link rel="preload">` the moment
 * their URL is known, while this hook handles lazy chapters that
 * shouldn't compete with the critical assets at app load.
 */
export function useAssetPreload(
  ref: RefObject<HTMLElement | null>,
  urls: ReadonlyArray<string | null | undefined>
): void {
  // Stringify the URL set into a single dep value so the effect only
  // re-binds when the actual URL contents change. A new array identity
  // each render would otherwise re-bind the observer every commit.
  const urlKey = urls.filter((u): u is string => Boolean(u)).join("|");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resolved = urlKey.length > 0 ? urlKey.split("|") : [];
    if (resolved.length === 0) return;

    const preloaded = new Set<string>();
    const preload = (url: string) => {
      if (preloaded.has(url)) return;
      preloaded.add(url);
      const img = new Image();
      img.src = url;
    };

    if (typeof IntersectionObserver === "undefined") {
      for (const url of resolved) preload(url);
      return;
    }

    const el = ref.current;
    if (!el) return;
    const main = mainScrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            for (const url of resolved) preload(url);
            observer.disconnect();
            break;
          }
        }
      },
      { root: main ?? null, rootMargin: PRELOAD_ROOT_MARGIN }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref, urlKey]);
}
