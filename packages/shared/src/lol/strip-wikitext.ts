// Convert MediaWiki template markup to plain text suitable for plain-string
// tooltip rendering. Not a full wiki parser — handles the patterns we
// actually see in `Module:ItemData/data` `effects.pass.description` fields
// and `Template:Data X/Y` `description` values:
//
//   `{{name|arg1|arg2}}` → `arg1` (templates render their first positional
//   arg in the patterns that matter — `{{as|200% AD}}` → "200% AD",
//   `{{fd|1.5}}` → "1.5", `{{sbc|Active:}}` → "Active:"). When there is no
//   positional arg, fall back to the template name so e.g. `{{bug}}` → "bug".
//
//   `[[anchor|display]]` → `display`, `[[anchor]]` → `anchor`.
//
//   `'''bold'''` / `''italic''` markers are stripped (kept inline).
//
//   `<!-- comment -->` blocks are removed.
//
// Templates can nest (`{{as|{{ai|Recall|self}}}}`); a fixed-iteration loop
// peels innermost matches each pass until the string stabilises. Five
// passes is enough for every nesting depth observed in current wiki data.
export function stripWikitext(input: string): string {
  if (!input) return "";
  let text = input.replace(/<!--[\s\S]*?-->/g, "");

  for (let i = 0; i < 5; i++) {
    const prev = text;
    // Innermost `{{name|args}}` — no nested braces inside.
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
      // Strip named flag arguments (`icononly=true`, etc.).
      const parts = body.split("|").filter((p) => !/^[\w\s]+=/.test(p));
      const name = parts[0]?.trim() ?? "";
      const arg1 = parts[1]?.trim();
      if (arg1 !== undefined && arg1.length > 0) return arg1;
      return name;
    });
    // `[[anchor|display]]` keeps display text; `[[anchor]]` keeps anchor.
    text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
    text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
    if (text === prev) break;
  }

  // Bold + italic markers, after templates resolved so inner `'''…'''`
  // inside `{{as|…}}` is also reached.
  text = text.replace(/'''/g, "").replace(/''/g, "");
  // HTML tags — `descriptionHtml` is the action=parse output and arrives
  // here when the wiki sync populated it; strip the rendered markup so
  // both source paths land at the same plain-text shape.
  text = text.replace(/<[^>]*>/g, " ");
  // Collapse runs of whitespace + trim.
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
