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
    const html = '<img src="/en-us/images/Magic_damage.png" alt="Magic">';
    expect(toRichDescription(html)).toBe(
      '<img src="http://localhost:2010/img/lol/wiki-file/Magic_damage.png.webp" alt="Magic">'
    );
  });

  it("rewrites a wiki thumbnail src by extracting the original filename", () => {
    const html =
      '<img src="/en-us/images/thumb/Dash.png/20px-Dash.png?e5c61" alt="Dash">';
    expect(toRichDescription(html)).toBe(
      '<img src="http://localhost:2010/img/lol/wiki-file/Dash.png.webp" alt="Dash">'
    );
  });

  it("drops <img> whose src is not a wiki upload path", () => {
    const html = 'before<img src="https://elsewhere.example/x.png" alt="x">after';
    expect(toRichDescription(html)).toBe("beforeafter");
  });

  it("unwraps wiki {{ft|long|short}} to the long arm without brackets", () => {
    const html =
      'deals <span class="flipText1 active">「&#160;200 damage&#160;」</span><span class="flipText2">「&#160;200&#160;」</span>';
    expect(toRichDescription(html)).toBe("deals 200 damage");
  });

  it("strips the flipText2 arm even when flipText1 is missing the active class", () => {
    const html =
      '<span class="flipText1">「&#160;long form&#160;」</span><span class="flipText2">「&#160;short&#160;」</span>';
    expect(toRichDescription(html)).toBe("long form");
  });
});
