// Reproduce: after the caret lands the user at the multi-beat Steam
// chapter's outer-top, the vertical beat index chrome should appear
// IMMEDIATELY but actually doesn't until the user scrolls further.
//
// Strategy: skip the caret (its target chapter is variable) and directly
// programmatic-scroll main to the chapter's outer-top, mirroring exactly
// what caret.handleClick does: `main.scrollTo({ top: next.top })`.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", { waitUntil: "networkidle" });
await page.waitForSelector("[data-chapter-multi-beat]");

const inspect = (label) =>
  page
    .evaluate(() => {
      const chrome = document.querySelector("[data-editorial-chrome]");
      const main = document.querySelector("main");
      if (!chrome || !main) return { chromeInDom: !!chrome, mainInDom: !!main };
      const section = chrome.closest("[data-chapter-multi-beat]");
      const sr = section?.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      const cs = window.getComputedStyle(chrome);
      return {
        chromeDisplay: cs.display,
        chromeOpacity: Number(cs.opacity).toFixed(2),
        mainScrollTop: main.scrollTop,
        mr: { t: Math.round(mr.top), b: Math.round(mr.bottom) },
        sr: sr
          ? { t: Math.round(sr.top), b: Math.round(sr.bottom), h: Math.round(sr.height) }
          : null,
        inPinRange: sr ? sr.top <= mr.top && sr.bottom >= mr.bottom : null,
      };
    })
    .then((r) => {
      console.log(`${label}: ${JSON.stringify(r)}`);
      return r;
    });

// 1. INITIAL — hero
await inspect("INITIAL                  ");

// 2. Compute the multi-beat section's absolute scrollTop (its current rect
// top + current main.scrollTop) — this is what the caret advances to.
const targetScroll = await page.evaluate(() => {
  const section = document.querySelector("[data-chapter-multi-beat]");
  const main = document.querySelector("main");
  if (!section || !main) return null;
  const sr = section.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  // The offset within main: how far below main.top the section currently sits,
  // plus current scrollTop = the scrollTop at which section.top == main.top.
  return main.scrollTop + (sr.top - mr.top);
});
console.log(`\nTarget scrollTop for multi-beat outer top: ${targetScroll}\n`);

// 3. Instant-scroll to multi-beat outer-top (mirrors caret with behavior=auto).
await page.evaluate((top) => {
  const main = document.querySelector("main");
  main?.scrollTo({ top, behavior: "auto" });
}, targetScroll);
await page.waitForTimeout(100);
await inspect("INSTANT scroll, +100ms   ");

// 4. Sample every 100ms for 2s to see if chrome appears spontaneously.
console.log("\n— sampling post-instant-scroll —");
for (let i = 1; i <= 12; i += 1) {
  await page.waitForTimeout(100);
  await inspect(`  +${i * 100}ms                 `);
}

// 5. Now SMOOTH scroll back to top then SMOOTH scroll to multi-beat —
// matches caret behavior (behavior=smooth).
await page.evaluate(() =>
  document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" })
);
await page.waitForTimeout(300);
await inspect("\nback at top              ");
await page.evaluate((top) => {
  const main = document.querySelector("main");
  main?.scrollTo({ top, behavior: "smooth" });
}, targetScroll);
console.log("\n— sampling during smooth scroll —");
for (let i = 1; i <= 12; i += 1) {
  await page.waitForTimeout(100);
  await inspect(`  +${i * 100}ms                 `);
}

// 6. Nudge user-scroll +50px and see if chrome shows.
console.log("\n— wheel nudges to simulate user scroll —");
for (let i = 1; i <= 3; i += 1) {
  await page.mouse.wheel(0, 50);
  await page.waitForTimeout(150);
  await inspect(`  after wheel ${i}            `);
}

await browser.close();
