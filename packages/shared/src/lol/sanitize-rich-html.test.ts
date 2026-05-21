import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "./sanitize-rich-html";

describe("sanitizeRichHtml", () => {
  it("returns empty string for nullish input", () => {
    expect(sanitizeRichHtml(null)).toBe("");
    expect(sanitizeRichHtml(undefined)).toBe("");
    expect(sanitizeRichHtml("")).toBe("");
  });

  it("keeps inline formatting tags from the allowlist", () => {
    const html = "<b>bold</b> and <i>italic</i> and <strong>strong</strong>";
    expect(sanitizeRichHtml(html)).toBe(
      "<b>bold</b> and <i>italic</i> and <strong>strong</strong>"
    );
  });

  it("keeps lists and line breaks", () => {
    const html = "<ul><li>one</li><li>two</li></ul><br>after";
    expect(sanitizeRichHtml(html)).toBe("<ul><li>one</li><li>two</li></ul><br>after");
  });

  it("preserves a span with a class attribute", () => {
    const html = '<span class="ability-icon-magic">Magic Damage</span>';
    expect(sanitizeRichHtml(html)).toBe(
      '<span class="ability-icon-magic">Magic Damage</span>'
    );
  });

  it("preserves <img> with src/alt/width/height and drops other attrs", () => {
    const html =
      '<img src="/images/Magic_damage.png" alt="Magic" width="16" height="16" onerror="alert(1)" data-foo="x">';
    expect(sanitizeRichHtml(html)).toBe(
      '<img src="/images/Magic_damage.png" alt="Magic" width="16" height="16">'
    );
  });

  it("drops <a> tags but keeps their text", () => {
    const html = '<a href="/wiki/Magic_damage">Magic damage</a>';
    expect(sanitizeRichHtml(html)).toBe("Magic damage");
  });

  it("removes <script> elements including their content", () => {
    const html = "before<script>alert(1)</script>after";
    expect(sanitizeRichHtml(html)).toBe("beforeafter");
  });

  it("removes <style> elements including their content", () => {
    const html = "before<style>body{display:none}</style>after";
    expect(sanitizeRichHtml(html)).toBe("beforeafter");
  });

  it("rejects javascript: img src", () => {
    const html = '<img src="javascript:alert(1)" alt="x">';
    expect(sanitizeRichHtml(html)).toBe('<img alt="x">');
  });

  it("rejects data: img src", () => {
    const html = '<img src="data:text/html;base64,PHNjcmlwdD4=" alt="x">';
    expect(sanitizeRichHtml(html)).toBe('<img alt="x">');
  });

  it("strips disallowed tags like <iframe> entirely", () => {
    const html = 'before<iframe src="evil"></iframe>after';
    expect(sanitizeRichHtml(html)).toBe("beforeafter");
  });

  it("strips disallowed inline tags but keeps their content", () => {
    const html = "<div>kept</div>";
    expect(sanitizeRichHtml(html)).toBe("kept");
  });

  it("drops style attributes from spans", () => {
    const html = '<span style="color:red" class="callout">200</span>';
    expect(sanitizeRichHtml(html)).toBe('<span class="callout">200</span>');
  });

  it("drops on* event handlers from any tag", () => {
    const html = '<span onclick="alert(1)" class="ok">x</span>';
    expect(sanitizeRichHtml(html)).toBe('<span class="ok">x</span>');
  });

  it("escapes quotes / angle brackets in retained attribute values", () => {
    const html = '<img src="/a&b.png" alt="he said &quot;hi&quot;">';
    const out = sanitizeRichHtml(html);
    expect(out).toContain('src="/a&amp;b.png"');
    expect(out).not.toMatch(/alt="he said "hi""/);
  });

  it("keeps a realistic wiki snippet with inline icons", () => {
    const html =
      'Deals <span class="callout"><img src="/img/lol/ui/attack.webp" alt="AD" width="16" height="16"> 200</span> physical damage.';
    expect(sanitizeRichHtml(html)).toBe(
      'Deals <span class="callout"><img src="/img/lol/ui/attack.webp" alt="AD" width="16" height="16"> 200</span> physical damage.'
    );
  });

  it("strips HTML comments", () => {
    expect(sanitizeRichHtml("foo<!-- editor note -->bar")).toBe("foobar");
  });
});
