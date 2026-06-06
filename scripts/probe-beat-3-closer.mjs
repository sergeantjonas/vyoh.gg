// Probe: beat 3 (closer) renders the SteamChapterCloserMedia slot
// (screenshot strip) + a right-anchored mirror accent slash below it.
// Verifies the slash is `from="right"` (anchored at right edge of the
// reading column, scaleX 0 → 1 anchored right).
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

// Scroll to near the end of the chapter so beat 3 (last) is in dwell.
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const rect = chapter.getBoundingClientRect();
  // 90% of chapter scroll = inside beat 3's dwell zone
  const top = rect.top + main.scrollTop + rect.height * 0.9;
  main.scrollTo({ top, behavior: "instant" });
});
// Wait for nudge + slash delay (1.1s) + slash tween (0.7s) = ~1.9s
await page.waitForTimeout(2200);

const geom = await page.evaluate(() => {
  const beat3 = document.querySelector("[data-chapter-multi-beat] [data-beat='3']");
  const closer = beat3?.querySelector("[data-band='closer']");
  const slash = beat3?.querySelector("[data-beat-accent-slash]");
  const strip = closer?.querySelector("a, img");

  const closerRect = closer?.getBoundingClientRect();
  const slashRect = slash?.getBoundingClientRect();
  const stripRect = strip?.getBoundingClientRect();
  const slashStyle = slash ? window.getComputedStyle(slash) : null;

  return {
    beat3Mounted: !!beat3,
    closerMounted: !!closer,
    slashMounted: !!slash,
    stripMounted: !!strip,
    closerRight: closerRect?.right,
    slashRight: slashRect?.right,
    slashTop: slashRect?.top,
    stripTop: stripRect?.top,
    slashBelowStrip: slashRect && stripRect ? slashRect.top > stripRect.bottom : null,
    slashRightAligned:
      slashRect && closerRect ? Math.abs(slashRect.right - closerRect.right) < 80 : null,
    slashTransform: slashStyle?.transform,
  };
});

console.log("BEAT 3 GEOMETRY:", JSON.stringify(geom, null, 2));

const failures = [];
if (!geom.beat3Mounted) failures.push("beat 3 wrapper not found");
if (!geom.closerMounted) failures.push("closer band not found");
if (!geom.slashMounted) failures.push("slash not found");
if (!geom.stripMounted) failures.push("screenshot strip not rendered");
if (!geom.slashBelowStrip)
  failures.push("expected slash to sit below the screenshot strip");
if (!geom.slashRightAligned)
  failures.push(
    `expected slash to be right-aligned (within 80px of closer's right edge); slash.right=${geom.slashRight}, closer.right=${geom.closerRight}`
  );

// Slash should be at scaleX ≈ 1 by now (delay + tween elapsed).
const parseMatrix = (t) => {
  if (!t || t === "none") return { a: 1 };
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return { a: 1 };
  const parts = m[1].split(",").map((s) => Number.parseFloat(s.trim()));
  return { a: parts[0] ?? 1 };
};
const settled = parseMatrix(geom.slashTransform);
console.log(`scaleX settled = ${settled.a} (expect ~1)`);
if (settled.a < 0.85)
  failures.push(`slash scaleX did not settle (got ${settled.a.toFixed(2)})`);

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
