import { describe, expect, it } from "vitest";
import { toRichDescription } from "./rich-description";

describe("toRichDescription", () => {
  it("returns null for nullish/empty input", () => {
    expect(toRichDescription(null)).toBeNull();
    expect(toRichDescription(undefined)).toBeNull();
    expect(toRichDescription("")).toBeNull();
  });

  it("returns null when the sanitiser strips everything", () => {
    expect(toRichDescription("<script>alert(1)</script>")).toBeNull();
  });

  it("keeps allowed inline formatting", () => {
    expect(toRichDescription("<b>Active</b>: do thing")).toBe("<b>Active</b>: do thing");
  });

  it("rewrites wiki <img src> to a proxy URL", () => {
    const html = '<img src="/en-us/images/2/2a/Magic_damage.png" alt="Magic">';
    expect(toRichDescription(html)).toBe(
      '<img src="http://localhost:2010/img/lol/wiki-file/Magic_damage.png.webp" alt="Magic">'
    );
  });

  it("rewrites a wiki thumbnail src by extracting the original filename", () => {
    const html = '<img src="/en-us/images/thumb/2/2a/Gold.png/16px-Gold.png" alt="Gold">';
    expect(toRichDescription(html)).toBe(
      '<img src="http://localhost:2010/img/lol/wiki-file/Gold.png.webp" alt="Gold">'
    );
  });

  it("drops <img> whose src is not a wiki upload path", () => {
    const html = 'before<img src="https://elsewhere.example/x.png" alt="x">after';
    expect(toRichDescription(html)).toBe("beforeafter");
  });
});
