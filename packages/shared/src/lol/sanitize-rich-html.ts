// Allowlist sanitizer for wiki `action=parse` HTML — the rich-tooltip path
// downstream of `descriptionHtml` on item / ability / perk / summoner-spell
// DTOs. Wiki output is well-formed and uses a small tag set (~10), so a
// purpose-built sanitizer beats pulling in a 20kB DOMPurify dependency.
//
// Tag policy: keep inline formatting, lists, line breaks, and `<img>`/`<span>`
// (the carriers for inline icons and color callouts). Everything else is
// dropped to text — including `<a>`, since wiki anchors point to wiki pages
// the tooltip should not navigate to.
//
// Attribute policy: `<img>` keeps `src`/`alt`/`width`/`height`; `<span>` keeps
// `class` so the render layer can map a closed set of wiki class names to
// Tailwind styles. Everything else is dropped. `src` is filtered against a
// scheme allowlist — `javascript:` / `data:` / `vbscript:` are rejected even
// inside `<img>`.
//
// URL rewriting (wiki File: paths → image-proxy paths) is NOT this layer's
// job — that's the next chunk (R2). This layer's contract is: the output is
// safe to feed into `dangerouslySetInnerHTML`, but the `<img src>` values may
// still point at wiki upstream until the proxy rewrite lands.

// `h1`/`h2`/`h3` were added for the Steam BBCode pipeline (chunk 8 in
// docs/working-notes/steam/library-card-enrichment.md): Steam descriptions
// emit `[h1]…[/h1]` section headers liberally. Structural tags only — no
// attributes, no scripting surface, safe by definition.
const ALLOWED_TAGS = new Set([
  "b",
  "br",
  "em",
  "h1",
  "h2",
  "h3",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "sub",
  "sup",
  "ul",
]);

const EMPTY_ATTRS: ReadonlySet<string> = new Set();

const ATTR_ALLOW: Record<string, ReadonlySet<string>> = {
  img: new Set(["src", "alt", "width", "height"]),
  span: new Set(["class"]),
  ol: new Set(["start"]),
};

const VOID_TAGS = new Set(["br", "img"]);

// Strip the content too (not just the tags) for script-ish elements — leaving
// the inner text of a `<script>` block in place would let attackers smuggle
// JS as literal text that any future innerHTML-on-the-output handler would
// re-parse. Wiki never emits these, but the cost of being safe is one regex.
const DROP_ELEMENT_RE = /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

// Tag matcher. Captures: leading `/` for close tags, tag name, attribute
// body. Trailing `/` (self-closing) is absorbed by the `[^>]*?` body and the
// `\/?>` close — we don't need to track it, since void tags are listed
// explicitly.
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\/?>/g;

// Attribute matcher inside a tag's attribute string. Handles double-quoted,
// single-quoted, and unquoted values, plus boolean attributes (no `=`).
const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_.:]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(attrStr: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of attrStr.matchAll(ATTR_RE)) {
    const name = m[1]?.toLowerCase();
    if (!name) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    out.set(name, value);
  }
  return out;
}

function isSafeImgSrc(src: string): boolean {
  const trimmed = src.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return false;
  if (trimmed.startsWith("data:")) return false;
  if (trimmed.startsWith("vbscript:")) return false;
  return true;
}

export interface SanitizeRichHtmlOptions {
  // Optional rewrite for `<img src>` values. Web supplies a wiki→proxy mapper
  // here so inline icons route through the image proxy instead of leaking the
  // wiki upstream into the browser. Return `null` to drop the `<img>` entirely
  // (e.g. when the src doesn't match a recognised wiki upload path).
  rewriteImgSrc?: (src: string) => string | null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sanitizeRichHtml(
  input: string | null | undefined,
  options: SanitizeRichHtmlOptions = {}
): string {
  if (!input) return "";
  let html = input.replace(DROP_ELEMENT_RE, "").replace(COMMENT_RE, "");
  html = html.replace(TAG_RE, (_full, slash: string, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (slash) return `</${name}>`;
    const allowed = ATTR_ALLOW[name] ?? EMPTY_ATTRS;
    const parsed = parseAttrs(attrs);
    if (name === "img") {
      const rawSrc = parsed.get("src");
      if (rawSrc === undefined || !isSafeImgSrc(rawSrc)) {
        // No src or unsafe scheme — drop the img. `<img>` without a src is
        // a layout-shifting empty box; the rich-tooltip surface always wants
        // an image-or-nothing.
        return "";
      }
      if (options.rewriteImgSrc) {
        const rewritten = options.rewriteImgSrc(rawSrc);
        if (rewritten === null) return "";
        parsed.set("src", rewritten);
      }
    }
    const kept: string[] = [];
    for (const [k, v] of parsed) {
      if (!allowed.has(k)) continue;
      if (k === "src" && !isSafeImgSrc(v)) continue;
      kept.push(`${k}="${escapeAttr(v)}"`);
    }
    const attrPart = kept.length > 0 ? ` ${kept.join(" ")}` : "";
    if (VOID_TAGS.has(name)) return `<${name}${attrPart}>`;
    return `<${name}${attrPart}>`;
  });
  return html;
}
