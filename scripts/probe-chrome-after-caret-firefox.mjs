// Firefox variant of probe-chrome-after-caret. The Chrome version showed
// the chrome `display: block` immediately after the rAF-tolerance fix
// landed, but owner reports the chrome still doesn't show in Firefox.
//
// Firefox uses Motion's rAF fallback for useScroll (not native
// ScrollTimeline), and `requestAnimationFrame` itself is supposed to
// work identically — so the failure mode must be either:
//   (a) The rect arithmetic produces a different geometry on Firefox
//       (different nav-shrink, different scroll-padding, different
//        scrollbar behavior)
//   (b) The rAF tick isn't firing inside Firefox for this DOM
//   (c) `chrome.closest(...)` returns differently due to a slot/portal
//       behavior diff
//
// This probe runs the same inspect pattern under Firefox and lets us
// see which.
import { firefox } from "playwright";

const browser = await firefox.launch({ headless: true });
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
      const TOLERANCE = 32;
      return {
        chromeDisplay: cs.display,
        chromeOpacity: Number(cs.opacity).toFixed(2),
        mainScrollTop: main.scrollTop,
        mr: { t: Math.round(mr.top), b: Math.round(mr.bottom) },
        sr: sr
          ? { t: Math.round(sr.top), b: Math.round(sr.bottom), h: Math.round(sr.height) }
          : null,
        // Hand-evaluate the production check from editorial-chrome.tsx.
        inPinRangeProd: sr
          ? sr.top <= mr.top + TOLERANCE && sr.bottom >= mr.bottom
          : null,
        sectionHasMultiBeatAttr:
          section?.hasAttribute("data-chapter-multi-beat") ?? false,
      };
    })
    .then((r) => {
      console.log(`${label}: ${JSON.stringify(r)}`);
      return r;
    });

await inspect("INITIAL                  ");

const targetScroll = await page.evaluate(() => {
  const section = document.querySelector("[data-chapter-multi-beat]");
  const main = document.querySelector("main");
  if (!section || !main) return null;
  const sr = section.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  return main.scrollTop + (sr.top - mr.top);
});
console.log(`\nTarget scrollTop: ${targetScroll}\n`);

await page.evaluate((top) => {
  const main = document.querySelector("main");
  main?.scrollTo({ top, behavior: "auto" });
}, targetScroll);
await page.waitForTimeout(100);
await inspect("INSTANT scroll, +100ms   ");

console.log("\n— sampling for 2.5s —");
for (let i = 1; i <= 10; i += 1) {
  await page.waitForTimeout(250);
  await inspect(`  +${i * 250}ms              `);
}

// Then nudge user-scroll and see if chrome shows.
console.log("\n— wheel nudges —");
for (let i = 1; i <= 5; i += 1) {
  await page.mouse.wheel(0, 50);
  await page.waitForTimeout(200);
  await inspect(`  after wheel ${i}            `);
}

await browser.close();
