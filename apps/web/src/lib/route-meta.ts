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
}

export function routeMeta(opts: RouteMetaOptions) {
  const { title, description, ogImage, ogType = "website" } = opts;
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
  return { meta };
}
