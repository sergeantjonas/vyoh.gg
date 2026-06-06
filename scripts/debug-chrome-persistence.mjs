// Debug probe: catch the previous chapter's editorial chrome
// persisting into the next chapter on Chromium. Owner confirms it
// happens on both Chrome and Safari, not just Safari, so it's
// reproducible in headless Chromium.
//
// Plan:
//   1. Load the page with multi-beat layout
//   2. Scroll into the FIRST chapter, verify its chrome is visible
//      and inspect its DOM
//   3. Scroll PAST the first chapter into the second
//   4. Take inventory of ALL [data-editorial-chrome] elements on the
//      page — their position, computed display, and visibility
//   5. Verify the previous chapter's chrome is properly hidden
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

// How many multi-beat chapters exist on the page?
const chapterCount = await page.evaluate(() => {
  return document.querySelectorAll("[data-chapter-multi-beat]").length;
});
console.log(`Multi-beat chapters on page: ${chapterCount}`);

if (chapterCount < 2) {
  console.error("Need at least 2 multi-beat chapters to reproduce. Aborting.");
  await browser.close();
  process.exit(1);
}

// Helper: snapshot every chrome on the page
const inventory = async () => {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-editorial-chrome]")).map(
      (chrome, i) => {
        const rect = chrome.getBoundingClientRect();
        const style = window.getComputedStyle(chrome);
        const section = chrome.closest("[data-chapter-multi-beat]");
        const sectionRect = section?.getBoundingClientRect();
        const sectionSlug = section?.getAttribute("data-chapter");
        const activeNum =
          chrome.querySelector('button[aria-current="true"]')?.textContent?.trim() ?? "?";
        return {
          idx: i,
          sectionSlug,
          activeNum,
          chromeRect: {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
          },
          chromeDisplay: style.display,
          chromeOpacity: style.opacity,
          chromeVisibility: style.visibility,
          sectionRectTop: sectionRect ? Math.round(sectionRect.top) : null,
          sectionRectBottom: sectionRect ? Math.round(sectionRect.bottom) : null,
        };
      }
    );
  });
};

// Scroll to halfway through the first chapter
console.log("\n— Step 1: scroll into first chapter (50% through)");
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const rect = chapter.getBoundingClientRect();
  const top = rect.top + main.scrollTop + rect.height * 0.5;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(500);
console.log("Inventory:", JSON.stringify(await inventory(), null, 2));

// Scroll to the EXIT TRANSITION moment — first chapter bottoming-out
// of its sticky pin, second chapter starting to enter. This is where
// owner reported the previous chrome scrolling along with content.
console.log("\n— Step 2: exit transition (first chapter exiting upward)");
await page.evaluate(() => {
  const chapters = document.querySelectorAll("[data-chapter-multi-beat]");
  const first = chapters[0];
  if (!first) return;
  const main = document.querySelector("main");
  if (!main) return;
  const rect = first.getBoundingClientRect();
  // Position first chapter such that its bottom edge sits ~half a
  // viewport above main bottom — sticky has bottomed-out, stage is
  // dragging upward with section.
  const top = rect.top + main.scrollTop + rect.height - main.clientHeight * 0.5;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(500);
console.log("Inventory at exit transition:", JSON.stringify(await inventory(), null, 2));

// Now scroll well past — into the SECOND chapter's middle
console.log("\n— Step 3: scroll past first chapter, into second (50% through)");
await page.evaluate(() => {
  const chapters = document.querySelectorAll("[data-chapter-multi-beat]");
  const second = chapters[1];
  if (!second) return;
  const main = document.querySelector("main");
  if (!main) return;
  const rect = second.getBoundingClientRect();
  const top = rect.top + main.scrollTop + rect.height * 0.5;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(500);
console.log("Inventory:", JSON.stringify(await inventory(), null, 2));

// Inspect: is the FIRST chapter's chrome visible (rendered or display:none)?
// Verify chrome 0's display is none OR it's off-screen.
const final = await inventory();
const firstChrome = final[0];
const failures = [];
if (!firstChrome) {
  console.log("First chrome no longer in DOM (good — fully unmounted)");
} else {
  // First chapter's section should be ABOVE viewport (top + bottom both
  // < 0 typically). If chrome is still rendering at a y position INSIDE
  // viewport (0..900), that's the bug.
  const inViewport =
    firstChrome.chromeRect.top < 900 && firstChrome.chromeRect.bottom > 0;
  const isHidden =
    firstChrome.chromeDisplay === "none" ||
    firstChrome.chromeVisibility === "hidden" ||
    Number.parseFloat(firstChrome.chromeOpacity) < 0.01;
  console.log(
    `First chrome: inViewport=${inViewport}, isHidden=${isHidden}, display=${firstChrome.chromeDisplay}, opacity=${firstChrome.chromeOpacity}`
  );
  if (inViewport && !isHidden)
    failures.push(
      `First chrome is RENDERING IN VIEWPORT (top=${firstChrome.chromeRect.top}, opacity=${firstChrome.chromeOpacity}, display=${firstChrome.chromeDisplay}) but its section is past — should be hidden`
    );
}

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nPASS — no chrome persistence detected");
}

await browser.close();
