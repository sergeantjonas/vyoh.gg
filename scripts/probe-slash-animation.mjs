// Probe: verify the beat 0 accent slash draws itself in place via
// scaleX(0 → 1) anchored at transform-origin: left, triggered by the
// binary beat nudge (the same signal ChapterReveal uses) — NOT scroll-
// coupled. The slash animates on time when the beat becomes the
// dominant one; it does not sweep across the viewport, and it does not
// depend on the user having scrolled inside the beat.
//
// Asserts:
//   1. scaleX settles to ~1 once the beat is in view (after time enough
//      for the 0.7s tween to complete)
//   2. translateX stays at ~0 throughout (no viewport-crossing sweep)
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

const scrubToChapterProgress = async (frac) => {
  await page.evaluate((f) => {
    const chapter = document.querySelector("[data-chapter-multi-beat]");
    if (!chapter) return;
    const main = document.querySelector("main");
    if (!main) return;
    const rect = chapter.getBoundingClientRect();
    const top = rect.top + main.scrollTop + rect.height * f;
    main.scrollTo({ top, behavior: "instant" });
  }, frac);
  await page.waitForTimeout(300);
};

const readSlashTransform = async () => {
  return page.evaluate(() => {
    const slash = document.querySelector(
      "[data-chapter-multi-beat] [data-beat='0'] [data-beat-accent-slash]"
    );
    if (!slash) return null;
    const style = window.getComputedStyle(slash);
    return {
      transform: style.transform,
      opacity: style.opacity,
    };
  });
};

// Scroll chapter to top and wait > tween duration. Slash should settle
// at scaleX ≈ 1 once nudge fires.
await scrubToChapterProgress(0);
await page.waitForTimeout(1200);
const atSettled = await readSlashTransform();
console.log("SETTLED AT CHAPTER TOP:", JSON.stringify(atSettled, null, 2));

// Mid-chapter (beat 1 or 2 active). Beat 0 has scrolled out — its slash
// nudge has flipped false, slash should retract toward scaleX ≈ 0.
// Still no translateX involved.
await scrubToChapterProgress(0.4);
await page.waitForTimeout(1000);
const atMidChapter = await readSlashTransform();
console.log("AT CHAPTER PROGRESS 40%:", JSON.stringify(atMidChapter, null, 2));

const failures = [];
if (!atSettled || !atMidChapter)
  failures.push("slash element not found at one or more scroll positions");

// Parse transform = matrix(a, b, c, d, tx, ty). For a pure scaleX,
// a = scaleX, b = c = 0, tx = ty = 0.
const parseMatrix = (t) => {
  if (!t || t === "none") return { a: 1, tx: 0 };
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return { a: 1, tx: 0 };
  const parts = m[1].split(",").map((s) => Number.parseFloat(s.trim()));
  return { a: parts[0] ?? 1, tx: parts[4] ?? 0 };
};

if (atSettled) {
  const settled = parseMatrix(atSettled.transform);
  console.log(
    `scaleX settled=${settled.a} (expect ~1) translateX settled=${settled.tx} (expect ~0)`
  );
  if (settled.a < 0.9)
    failures.push(`scaleX at chapter top did not settle to ~1: ${settled.a.toFixed(2)}`);
  if (Math.abs(settled.tx) > 5)
    failures.push(
      `translateX should be ~0 (in-place draw, not viewport sweep) but got ${settled.tx}`
    );
}

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
