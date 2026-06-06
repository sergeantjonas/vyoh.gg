import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", { waitUntil: "networkidle" });
await page.waitForSelector("[data-chapter-multi-beat]");
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  const main = document.querySelector("main");
  const top = chapter.getBoundingClientRect().top + main.scrollTop;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(400);
const geom = await page.evaluate(() => {
  const masthead = document.querySelector("header[data-chapter-masthead]");
  const track = document.querySelector("[data-chapter-track]");
  const beat0 = document.querySelector("[data-chapter-multi-beat] [data-beat='0']");
  const beat0Inner = beat0?.firstElementChild;
  const opener = beat0?.querySelector("[data-band='opener']");
  // What's directly inside the beat? Children chain.
  const chain = [];
  let el = beat0?.firstElementChild;
  let depth = 0;
  while (el && depth < 6) {
    const r = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName,
      classes: el.className?.slice?.(0, 80),
      dataAttrs: Array.from(el.attributes)
        .filter((a) => a.name.startsWith("data-"))
        .map((a) => a.name),
      top: r.top,
      height: r.height,
      computedPaddingTop: getComputedStyle(el).paddingTop,
      computedMarginTop: getComputedStyle(el).marginTop,
    });
    el = el.firstElementChild;
    depth += 1;
  }
  return {
    masthead: masthead?.getBoundingClientRect(),
    track: track?.getBoundingClientRect(),
    beat0: beat0?.getBoundingClientRect(),
    beat0InnerRect: beat0Inner?.getBoundingClientRect(),
    chain,
  };
});
console.log(JSON.stringify(geom, null, 2));
await browser.close();
