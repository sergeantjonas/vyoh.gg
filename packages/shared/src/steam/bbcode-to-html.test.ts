import { describe, expect, it } from "vitest";
import { bbcodeToHtml } from "./bbcode-to-html.ts";

describe("bbcodeToHtml", () => {
  it("returns empty string for null / undefined / empty input", () => {
    expect(bbcodeToHtml(null)).toBe("");
    expect(bbcodeToHtml(undefined)).toBe("");
    expect(bbcodeToHtml("")).toBe("");
  });

  it("converts [h1]/[h2]/[h3] to their HTML equivalents", () => {
    expect(bbcodeToHtml("[h1]About[/h1]")).toBe("<h1>About</h1>");
    expect(bbcodeToHtml("[h2]Features[/h2]")).toBe("<h2>Features</h2>");
    expect(bbcodeToHtml("[h3]Note[/h3]")).toBe("<h3>Note</h3>");
  });

  it("converts inline formatting tags", () => {
    expect(bbcodeToHtml("[b]bold[/b]")).toBe("<p><strong>bold</strong></p>");
    expect(bbcodeToHtml("[i]italic[/i]")).toBe("<p><em>italic</em></p>");
    expect(bbcodeToHtml("[u]under[/u]")).toBe(
      '<p><span class="underline">under</span></p>'
    );
  });

  it("strips [url] tags but keeps the inner text", () => {
    expect(bbcodeToHtml("[url=https://example.com]Visit us[/url]")).toBe(
      "<p>Visit us</p>"
    );
    expect(bbcodeToHtml("[url]inline text[/url]")).toBe("<p>inline text</p>");
  });

  it("converts [img] to an <img> element", () => {
    expect(bbcodeToHtml("[img]https://cdn.example/foo.jpg[/img]")).toBe(
      '<p><img src="https://cdn.example/foo.jpg"></p>'
    );
  });

  it("drops [img] with an empty URL", () => {
    expect(bbcodeToHtml("[img][/img]")).toBe("");
  });

  it("converts [list]/[*] to <ul>/<li>", () => {
    const html = bbcodeToHtml("[list][*]one[*]two[/list]");
    expect(html).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("handles paired [*]…[/*] list items without leaking the closer", () => {
    const html = bbcodeToHtml("[list][*]one[/*][*]two[/*][/list]");
    expect(html).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("strips stray [*] / [/*] outside a [list] block", () => {
    expect(bbcodeToHtml("before [*]item[/*] after")).toBe("<p>before item after</p>");
  });

  it("converts [olist] to <ol>", () => {
    const html = bbcodeToHtml("[olist][*]first[*]second[/olist]");
    expect(html).toBe("<ol><li>first</li><li>second</li></ol>");
  });

  it("drops [previewyoutube] tags entirely", () => {
    expect(bbcodeToHtml("Intro [previewyoutube=ID]trailer[/previewyoutube] after")).toBe(
      "<p>Intro  after</p>"
    );
  });

  it("drops [table]/[tr]/[td] blocks entirely", () => {
    expect(bbcodeToHtml("Before[table][tr][td]X[/td][/tr][/table]After")).toBe(
      "<p>BeforeAfter</p>"
    );
  });

  it("escapes raw < and > so HTML can't be smuggled through inline conversions", () => {
    const html = bbcodeToHtml("[b]<script>alert('x')</script>[/b]");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("splits blank-line-separated text into paragraphs", () => {
    const html = bbcodeToHtml("First paragraph.\n\nSecond paragraph.");
    expect(html).toBe("<p>First paragraph.</p>\n<p>Second paragraph.</p>");
  });

  it("converts single newlines inside a paragraph to <br>", () => {
    const html = bbcodeToHtml("Line one\nLine two");
    expect(html).toBe("<p>Line one<br>Line two</p>");
  });

  it("does not wrap block-level elements (<h1>, <ul>) in <p>", () => {
    const html = bbcodeToHtml("[h1]Title[/h1]\n\n[list][*]item[/list]");
    expect(html).toBe("<h1>Title</h1>\n<ul><li>item</li></ul>");
  });

  it("strips unknown tags but keeps their inner text", () => {
    expect(bbcodeToHtml("[noparse]keep me[/noparse]")).toBe("<p>keep me</p>");
  });

  it("escapes attribute values inside [img] URLs", () => {
    expect(bbcodeToHtml('[img]foo"onerror=alert(1)//bar[/img]')).toContain(
      "&quot;onerror"
    );
  });

  it("handles a realistic mixed Steam description", () => {
    const source =
      "[h1]Game Title[/h1]\n\n" +
      "[b]Welcome[/b] to the world of...\n\n" +
      "[list][*]Feature one[*]Feature two[/list]\n\n" +
      "[h2]Key features[/h2]\n\n" +
      "Final paragraph with [url=https://example.com]a link[/url].";
    const html = bbcodeToHtml(source);
    expect(html).toContain("<h1>Game Title</h1>");
    expect(html).toContain("<strong>Welcome</strong>");
    expect(html).toContain("<ul><li>Feature one</li><li>Feature two</li></ul>");
    expect(html).toContain("<h2>Key features</h2>");
    expect(html).toContain("a link");
    expect(html).not.toContain("[url");
  });
});
