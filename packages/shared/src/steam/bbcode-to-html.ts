// BBCode → HTML transformer for Steam's `full_description_bbcode`. The
// Steam dialect is a constrained subset of generic BBCode (documented at
// https://steamcommunity.com/comment/Recommendation/formattinghelp). We only
// handle the tags publishers actually emit in storefront descriptions; the
// rest collapse to inner text rather than rendering as a stray tag.
//
// Output is HTML, not safe-to-render directly — feed through
// `sanitizeRichHtml` (LoL rich-description pipeline) before passing to
// `dangerouslySetInnerHTML`. That layer enforces the trust boundary; this
// one just translates the grammar.
//
// Tag policy (Steam → output HTML):
//   [h1]..[/h1]   → <h1>..</h1>      [h2]..[/h2]   → <h2>..</h2>
//   [h3]..[/h3]   → <h3>..</h3>
//   [b]..[/b]     → <strong>..</strong>
//   [i]..[/i]     → <em>..</em>
//   [u]..[/u]     → <span class="underline">..</span>
//   [list]..[/list]   → <ul>..</ul>     [olist]..[/olist] → <ol>..</ol>
//   [*] item          → <li>item</li>   (terminated by next [*] or end of list)
//   [img]URL[/img]    → <img src="URL"> (URL caller-rewritten via sanitizer)
//   [url=X]Y[/url]    → Y               (strip link, keep text — same policy
//   [url]Y[/url]      → Y                as the LoL sanitiser drops <a>)
//   blank line        → paragraph break (split into <p>..</p> blocks)
//   single newline    → <br>
//
// Drop policy (strip tags AND inner content for noise / security):
//   [previewyoutube=…]…[/previewyoutube]  — YouTube embed; we don't render
//   [video]…[/video]                       videos in the about block
//   [table] / [tr] / [th] / [td]           — Steam uses tables for system
//                                            requirements which we don't surface
//   [code]…[/code], [quote]…[/quote]       — descriptions don't need them
//
// Unknown tags fall through: their text content survives, the wrapping
// `[tag]...[/tag]` is stripped. Better than rendering a literal `[foo]` to
// the user when Valve adds a new tag we haven't mapped yet.

// Block tags whose entire inner content gets dropped. Lowercase-only — the
// matcher case-folds the open tag before checking.
const DROP_BLOCK_TAGS = new Set([
  "previewyoutube",
  "video",
  "table",
  "tr",
  "th",
  "td",
  "code",
  "quote",
]);

// Capture-once `s` flag is intentional — descriptions can span many lines.
const DROP_BLOCK_RE = (() => {
  const names = [...DROP_BLOCK_TAGS].join("|");
  return new RegExp(`\\[(${names})(?:=[^\\]]*)?\\][\\s\\S]*?\\[/\\1\\]`, "gi");
})();

const HEADING_RE = /\[h([1-3])\]([\s\S]*?)\[\/h\1\]/gi;
const BOLD_RE = /\[b\]([\s\S]*?)\[\/b\]/gi;
const ITALIC_RE = /\[i\]([\s\S]*?)\[\/i\]/gi;
const UNDERLINE_RE = /\[u\]([\s\S]*?)\[\/u\]/gi;
const URL_WITH_TEXT_RE = /\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi;
const URL_BARE_RE = /\[url\]([\s\S]*?)\[\/url\]/gi;
const IMG_RE = /\[img\]([\s\S]*?)\[\/img\]/gi;
// Drop any remaining unknown bracket tag (open or close, with optional
// `=value` arg). Inner content survives because we don't match across the
// closer here.
const UNKNOWN_TAG_RE = /\[\/?[a-zA-Z][a-zA-Z0-9]*(?:=[^\]]*)?\]/g;

// `[list]…[/list]` (and `[olist]`) handling is two-pass: convert the wrapper
// to `<ul>`/`<ol>`, then convert each `[*]` item to `<li>…</li>`. Inside the
// list block, we split on `[*]` boundaries; everything before the first `[*]`
// is whitespace/noise and is dropped.
const LIST_BLOCK_RE = /\[(o?list)\]([\s\S]*?)\[\/\1\]/gi;

// `[*]` and its closer `[/*]` aren't matched by UNKNOWN_TAG_RE (the `*`
// character isn't `[a-zA-Z]`). Steam emits both `[*]item` and `[*]item[/*]`
// forms — without this, the closer leaks through as literal text under each
// bullet (seen on Doom 3: BFG Edition's description).
const STRAY_ITEM_TAG_RE = /\[\/?\*\]/g;

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(input: string): string {
  return escapeHtml(input).replace(/"/g, "&quot;");
}

// Convert `[*]` items inside a (possibly nested) list body. Steam doesn't
// emit nested lists in practice, so we do a flat split.
function convertListItems(inner: string): string {
  const parts = inner.split(/\[\*\]/);
  // First part is content before the first [*] — drop (typically whitespace).
  const items = parts.slice(1).map((item) => {
    const trimmed = item.trim();
    return `<li>${trimmed}</li>`;
  });
  return items.join("");
}

// Paragraph splitter: blank lines = paragraph break, single newlines = <br>.
// Runs AFTER inline tags have been converted, so it doesn't tear through
// open/close pairs. Skips re-wrapping if the chunk is already a block-level
// element (`<h1>`, `<ul>`, etc.) — wrapping `<ul>` in `<p>` would be invalid
// HTML the sanitiser then strips inconsistently.
const BLOCK_PREFIX_RE = /^\s*<(?:h[1-6]|ul|ol|li|p)\b/i;

function paragraphise(html: string): string {
  const blocks = html.split(/\n{2,}/);
  const wrapped: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (BLOCK_PREFIX_RE.test(trimmed)) {
      wrapped.push(trimmed);
    } else {
      // Single newlines inside a paragraph become <br>.
      const withBreaks = trimmed.replace(/\n/g, "<br>");
      wrapped.push(`<p>${withBreaks}</p>`);
    }
  }
  return wrapped.join("\n");
}

export function bbcodeToHtml(input: string | null | undefined): string {
  if (!input) return "";
  // Escape first so any literal `<`/`>` in the source can't smuggle real HTML
  // through the inline-tag conversions below.
  let html = escapeHtml(input);
  // Drop block tags + inner content.
  html = html.replace(DROP_BLOCK_RE, "");
  // Lists before inline (a `[b]` inside a `[*]` should still bold).
  html = html.replace(LIST_BLOCK_RE, (_full, tag: string, inner: string) => {
    const items = convertListItems(inner);
    const wrap = tag.toLowerCase() === "olist" ? "ol" : "ul";
    return `<${wrap}>${items}</${wrap}>`;
  });
  // Inline conversions.
  html = html.replace(HEADING_RE, (_full, level: string, inner: string) => {
    return `<h${level}>${inner.trim()}</h${level}>`;
  });
  html = html.replace(BOLD_RE, (_full, inner: string) => `<strong>${inner}</strong>`);
  html = html.replace(ITALIC_RE, (_full, inner: string) => `<em>${inner}</em>`);
  html = html.replace(
    UNDERLINE_RE,
    (_full, inner: string) => `<span class="underline">${inner}</span>`
  );
  html = html.replace(IMG_RE, (_full, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    return `<img src="${escapeAttr(trimmed)}">`;
  });
  // URL: keep inner text, drop the link itself (LoL sanitiser policy).
  html = html.replace(URL_WITH_TEXT_RE, (_full, text: string) => text);
  html = html.replace(URL_BARE_RE, (_full, text: string) => text);
  // Strip any stray `[*]` / `[/*]` left outside a `[list]` block, or `[/*]`
  // closers consumed inside one (split-on-[*] leaves them in the item body).
  html = html.replace(STRAY_ITEM_TAG_RE, "");
  // Strip any remaining unknown bracket tags — their inner text survives.
  html = html.replace(UNKNOWN_TAG_RE, "");
  // Paragraph-split last so block-level elements don't get re-wrapped.
  return paragraphise(html);
}
