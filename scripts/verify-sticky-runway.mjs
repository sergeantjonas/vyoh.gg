// Verify that the chapter stays pinned through all 4 beats and releases
// exactly at chapter end. Scrolls through progress 0, 0.25, 0.5, 0.75, 1,
// observes stage rect (sticky vs released), track transform, and the beat
// in view.

import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
const page = await ctx.newPage();

await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

// Get the FIRST chapter's scroll bounds.
const bounds = await page.evaluate(() => {
  const main = document.querySelector("main");
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter || !main) return null;
  const sectionTopInMain =
    chapter.getBoundingClientRect().top +
    main.scrollTop -
    main.getBoundingClientRect().top;
  const sectionHeight = chapter.getBoundingClientRect().height;
  return {
    sectionTopInMain,
    sectionHeight,
    mainClientHeight: main.clientHeight,
    mainScrollHeight: main.scrollHeight,
    // useScroll progress 1 = scroll position where section.bottom touches main.bottom
    progressOneScroll: sectionTopInMain + sectionHeight - main.clientHeight,
  };
});
console.log("BOUNDS:", JSON.stringify(bounds, null, 2));

const progressPoints = [0, 0.25, 0.5, 0.75, 0.99];
for (const p of progressPoints) {
  const targetScroll =
    bounds.sectionTopInMain + p * (bounds.progressOneScroll - bounds.sectionTopInMain);
  await page.evaluate((s) => {
    document.querySelector("main").scrollTo({ top: s, behavior: "instant" });
  }, targetScroll);
  await page.waitForTimeout(300);

  const state = await page.evaluate((expected) => {
    const main = document.querySelector("main");
    const stage = document.querySelector("[data-chapter-stage]");
    const track = document.querySelector("[data-chapter-track]");
    const stageRect = stage?.getBoundingClientRect();
    return {
      mainScrollTop: main.scrollTop,
      expectedScroll: expected,
      stageTopInViewport: stageRect?.top,
      stageHeight: stageRect?.height,
      stageIsPinned: stageRect && Math.abs(stageRect.top - 50) < 5,
      trackTransform: track ? getComputedStyle(track).transform : null,
    };
  }, targetScroll);
  console.log(`\nprogress=${p}:`);
  console.log(JSON.stringify(state, null, 2));
}

await browser.close();
