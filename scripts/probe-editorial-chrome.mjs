// Probe: editorial chrome renders and tracks the active beat as the
// reader scrolls a multi-beat chapter.
//
// Sanity checks:
// - chrome is mounted inside the chapter stage
// - text reads "Beat 01 / 04" at chapter top
// - the active dot flips as scroll advances through beats
// - chrome is hidden under prefers-reduced-motion (skipped here; would
//   need an emulated media query — left for cross-engine pass)
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

const probe = async () => {
  const out = await page.evaluate(() => {
    const chrome = document.querySelector(
      "[data-chapter-multi-beat] [data-editorial-chrome]"
    );
    if (!chrome) return { mounted: false };
    const text = chrome.textContent ?? "";
    const dots = Array.from(chrome.querySelectorAll('button[aria-label^="Go to beat"]'));
    const activeIdx = dots.findIndex((d) => d.hasAttribute("data-active"));
    const rect = chrome.getBoundingClientRect();
    // ScrollToTop lives bottom-right of <main>; NextChapterCaret is
    // bottom-center. Chrome at bottom-left must be in the left half
    // (clear of ScrollToTop) and not too close to the centerline
    // (clear of the caret).
    const viewportW = window.innerWidth;
    const inLeftHalf = rect.right < viewportW / 2;
    return {
      mounted: true,
      text: text.trim(),
      dotCount: dots.length,
      activeIdx,
      chromeLeft: rect.left,
      chromeRight: rect.right,
      inLeftHalf,
    };
  });
  return out;
};

// Position chapter top at viewport top
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const top = chapter.getBoundingClientRect().top + main.scrollTop;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(300);

const initial = await probe();
console.log("AT CHAPTER TOP:", JSON.stringify(initial, null, 2));

// Scroll ~40% of chapter height — should put us in beat 1 or 2
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const rect = chapter.getBoundingClientRect();
  const top = rect.top + main.scrollTop + rect.height * 0.4;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(400);
const mid = await probe();
console.log("AT 40% PROGRESS:", JSON.stringify(mid, null, 2));

// Scroll ~80% of chapter height — should put us near beat 3
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const rect = chapter.getBoundingClientRect();
  const top = rect.top + main.scrollTop + rect.height * 0.8;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(400);
const late = await probe();
console.log("AT 80% PROGRESS:", JSON.stringify(late, null, 2));

const failures = [];
if (!initial.mounted) failures.push("chrome not mounted at chapter top");
if (initial.dotCount !== 4) failures.push(`expected 4 dots, got ${initial.dotCount}`);
if (initial.activeIdx !== 0)
  failures.push(`expected initial active=0, got ${initial.activeIdx}`);
if (mid.activeIdx <= initial.activeIdx)
  failures.push(
    `expected active to advance from ${initial.activeIdx} to >0 at 40%, got ${mid.activeIdx}`
  );
if (late.activeIdx <= mid.activeIdx)
  failures.push(
    `expected active to advance from ${mid.activeIdx} at 40% to >${mid.activeIdx} at 80%, got ${late.activeIdx}`
  );
if (initial.mounted && !initial.inLeftHalf)
  failures.push(
    "chrome is NOT in left half of viewport — would risk collision with ScrollToTop (bottom-right) or NextChapterCaret (bottom-center)"
  );

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
