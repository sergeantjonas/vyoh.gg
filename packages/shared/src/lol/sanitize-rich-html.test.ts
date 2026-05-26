import { describe, expect, it, vi } from "vitest";
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

  it("drops the entire <img> when src uses an unsafe scheme (javascript:)", () => {
    const html = 'before<img src="javascript:alert(1)" alt="x">after';
    expect(sanitizeRichHtml(html)).toBe("beforeafter");
  });

  it("drops the entire <img> when src uses an unsafe scheme (data:)", () => {
    const html = 'before<img src="data:text/html;base64,PHNjcmlwdD4=" alt="x">after';
    expect(sanitizeRichHtml(html)).toBe("beforeafter");
  });

  it("drops <img> with no src", () => {
    expect(sanitizeRichHtml('before<img alt="x">after')).toBe("beforeafter");
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

  describe("with rewriteImgSrc", () => {
    it("rewrites the src via the supplied mapper", () => {
      const html = '<img src="/en-us/images/2/2a/Magic_damage.png" alt="Magic">';
      expect(
        sanitizeRichHtml(html, {
          rewriteImgSrc: (s) => s.replace(/^\/en-us\/images\//, "/proxy/"),
        })
      ).toBe('<img src="/proxy/2/2a/Magic_damage.png" alt="Magic">');
    });

    it("drops the <img> when the mapper returns null", () => {
      const html = 'before<img src="https://evil.example.com/x.png" alt="x">after';
      expect(sanitizeRichHtml(html, { rewriteImgSrc: () => null })).toBe("beforeafter");
    });

    it("does not call the mapper for unsafe schemes (img already dropped)", () => {
      const mapper = vi.fn(() => "anything");
      sanitizeRichHtml('<img src="javascript:alert(1)" alt="x">', {
        rewriteImgSrc: mapper,
      });
      expect(mapper).not.toHaveBeenCalled();
    });

    it("escapes the rewritten src in the output", () => {
      const html = '<img src="/orig.png" alt="x">';
      const out = sanitizeRichHtml(html, {
        rewriteImgSrc: () => "/proxy?q=a&b",
      });
      expect(out).toContain('src="/proxy?q=a&amp;b"');
    });
  });

  describe("with allowVideo", () => {
    it("drops <video> and <source> by default (allowVideo not set)", () => {
      const html =
        '<video autoplay muted><source src="https://cdn/a.webm" type="video/webm"></video>';
      expect(sanitizeRichHtml(html)).toBe("");
    });

    it("keeps <video> with the playback-directive allowlist", () => {
      const html =
        '<video autoplay muted loop playsinline preload="metadata" width="780" height="320"></video>';
      expect(sanitizeRichHtml(html, { allowVideo: true })).toBe(
        '<video autoplay="" muted="" loop="" playsinline="" preload="metadata" width="780" height="320"></video>'
      );
    });

    it("strips Steam's class='bb_img' noise from <video>", () => {
      const html = '<video class="bb_img" autoplay></video>';
      expect(sanitizeRichHtml(html, { allowVideo: true })).toBe(
        '<video autoplay=""></video>'
      );
    });

    it("keeps <source> with src and type, drops other attrs", () => {
      const html =
        '<source src="https://cdn/a.webm" type="video/webm" onerror="alert(1)">';
      expect(sanitizeRichHtml(html, { allowVideo: true })).toBe(
        '<source src="https://cdn/a.webm" type="video/webm">'
      );
    });

    it("drops <source> with no src", () => {
      expect(sanitizeRichHtml('<source type="video/webm">', { allowVideo: true })).toBe(
        ""
      );
    });

    it("drops <source> when src uses an unsafe scheme", () => {
      expect(
        sanitizeRichHtml('<source src="javascript:alert(1)" type="video/webm">', {
          allowVideo: true,
        })
      ).toBe("");
    });

    it("strips <video poster> when the value uses an unsafe scheme but keeps the tag", () => {
      const html = '<video autoplay poster="javascript:alert(1)"></video>';
      expect(sanitizeRichHtml(html, { allowVideo: true })).toBe(
        '<video autoplay=""></video>'
      );
    });

    it("rewrites <video poster> and <source src> via rewriteVideoUrl", () => {
      const html =
        '<video autoplay poster="https://cdn/extras/abc.poster.avif"><source src="https://cdn/extras/abc.webm" type="video/webm"></video>';
      const out = sanitizeRichHtml(html, {
        allowVideo: true,
        rewriteVideoUrl: (s) => s.replace("https://cdn/", "/img/steam/desc/1/"),
      });
      expect(out).toContain('poster="/img/steam/desc/1/extras/abc.poster.avif"');
      expect(out).toContain('src="/img/steam/desc/1/extras/abc.webm"');
    });

    it("drops the <source> entirely when rewriteVideoUrl returns null", () => {
      const html =
        '<video autoplay><source src="https://cdn/unknown.webm" type="video/webm"></video>';
      const out = sanitizeRichHtml(html, {
        allowVideo: true,
        rewriteVideoUrl: () => null,
      });
      expect(out).toBe('<video autoplay=""></video>');
    });

    it("drops just the poster attribute when rewriteVideoUrl returns null on poster", () => {
      const html = '<video autoplay poster="https://cdn/unknown.avif"></video>';
      const out = sanitizeRichHtml(html, {
        allowVideo: true,
        rewriteVideoUrl: () => null,
      });
      expect(out).toBe('<video autoplay=""></video>');
    });

    it("keeps a realistic Steam about-block snippet", () => {
      const html =
        '<h2>About</h2><video class="bb_img" autoplay muted loop playsinline crossorigin="anonymous" poster="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/abc.poster.avif?t=1" width="780" height="320"><source src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/abc.webm?t=1" type="video/webm"></video><br>';
      const out = sanitizeRichHtml(html, {
        allowVideo: true,
        rewriteVideoUrl: (s) => s.replace(/^https:\/\/[^/]+/, "/proxy"),
      });
      expect(out).toContain("<h2>About</h2>");
      expect(out).toContain('poster="/proxy/store_item_assets/steam/apps/1245620');
      expect(out).toContain('src="/proxy/store_item_assets/steam/apps/1245620');
      expect(out).toContain('type="video/webm"');
      expect(out).toContain("<br>");
      expect(out).not.toContain("crossorigin");
      expect(out).not.toContain("bb_img");
    });
  });
});
