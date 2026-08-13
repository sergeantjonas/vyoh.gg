// Shared meta builder for TanStack Router `head()` blocks. Centralises the
// title / description / og / twitter scaffold so leaf routes stay declarative
// and a future change (e.g. a site-wide og:site_name addition) lands in one
// place. Pass `ogImage` only when a per-route image exists — without it we
// emit summary-card meta without the image bits, which gives sensible link
// previews without claiming an image that 404s.

interface RouteMetaOptions {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: "website" | "article" | "profile";
  /**
   * Override the root's site-wide `index, follow`. For routes that exist for
   * one person and say nothing a search result should carry.
   *
   * The meta tag is the half that matters: `robots.txt` can only ask a crawler
   * not to *fetch* a URL, and a page nobody fetched can still be indexed from
   * inbound links alone — with no snippet, because the crawler was never
   * allowed to read the thing that says not to index it.
   */
  noindex?: boolean;
}

export function routeMeta(opts: RouteMetaOptions) {
  const { title, description, ogImage, ogType = "website", noindex = false } = opts;
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (ogImage) {
    meta.push(
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: ogImage }
    );
  } else {
    meta.push({ name: "twitter:card", content: "summary" });
  }
  // Merges over the root's `robots` entry by name, so it has to be the same key
  // rather than an additional tag — two `robots` metas is undefined behaviour.
  if (noindex) meta.push({ name: "robots", content: "noindex, nofollow" });
  return { meta };
}
