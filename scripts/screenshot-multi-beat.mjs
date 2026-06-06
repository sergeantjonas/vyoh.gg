// Temporary screenshot + geometry probe for chunk-2 Firefox debugging.
// Not committed — delete after the Firefox issue is identified.

import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on("pageerror", (e) => console.log(`PAGE ERROR: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
  }
});

await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");
await page.screenshot({ path: "/tmp/multi-beat-top.png", fullPage: false });

// Scroll into the first Steam chapter
const chapter = await page.$("[data-chapter-multi-beat]");
await chapter.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/multi-beat-chapter.png", fullPage: false });

// Scroll to put beat 3 (screenshot strip) into focus.
// Beat 3 snap point ≈ chapter top + 210vh; we want beat 3 active.
await page.evaluate(() => {
  const main = document.querySelector("main");
  const beat3 = document.querySelector("[data-chapter-multi-beat] [data-beat='3']");
  if (beat3) {
    const beat3Top = beat3.getBoundingClientRect().top + main.scrollTop;
    // Land at beat 3's content area accounting for the 30vh masthead.
    main.scrollTo({ top: beat3Top - window.innerHeight * 0.3, behavior: "instant" });
  }
});
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/multi-beat-at-beat3.png", fullPage: false });

// Now scroll a bit past beat 3 (where user reports content gets pushed off)
await page.evaluate(() => {
  document.querySelector("main").scrollBy(0, 200);
});
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/multi-beat-past-beat3.png", fullPage: false });

// Scroll BACK to the chapter top so we probe at progress 0 (beat 0 should
// be the visible one). Mandatory snap is gone now so explicit scrollTo works.
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  const main = document.querySelector("main");
  if (chapter && main) {
    const top = chapter.getBoundingClientRect().top + main.scrollTop;
    main.scrollTo({ top, behavior: "instant" });
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/multi-beat-beat-zero.png", fullPage: false });

const geom = await page.evaluate(() => {
  const main = document.querySelector("main");
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  const stage = document.querySelector("[data-chapter-stage]");
  const masthead = document.querySelector("header[data-chapter-masthead]");
  const track = document.querySelector("[data-chapter-track]");
  const beats = Array.from(
    document.querySelectorAll("[data-chapter-multi-beat] [data-beat]")
  );
  return {
    mainScrollTop: main.scrollTop,
    mainClientHeight: main.clientHeight,
    chapterRect: chapter?.getBoundingClientRect(),
    stageRect: stage?.getBoundingClientRect(),
    mastheadRect: masthead?.getBoundingClientRect(),
    mastheadStyleHeight: masthead?.style.height,
    trackRect: track?.getBoundingClientRect(),
    trackComputedHeight: track ? getComputedStyle(track).height : null,
    trackComputedTransform: track ? getComputedStyle(track).transform : null,
    beatRects: beats.slice(0, 4).map((b) => ({
      index: b.getAttribute("data-beat"),
      rect: b.getBoundingClientRect(),
      computedHeight: getComputedStyle(b).height,
      hasContent: (b.textContent ?? "").trim().length > 0,
      childCount: b.childElementCount,
    })),
  };
});
console.log(JSON.stringify(geom, null, 2));

await browser.close();
