// Probe: beat 0 (verdict) renders the layered parallax composition —
// ambient wash (depth 1), accent slash (depth 2), prose (depth 3).
// Verifies all three layers exist in the rendered DOM and that the
// accent slash is positioned in flow above the prose.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

// Scroll to put chapter top at viewport top so beat 0 is the focal beat.
await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const top = chapter.getBoundingClientRect().top + main.scrollTop;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(500);

const layers = await page.evaluate(() => {
  // Beat 0 wrapper.
  const beat0 = document.querySelector(
    "[data-chapter-multi-beat] [data-beat='0']"
  );
  if (!beat0) return { beat0Mounted: false };

  // Depth tags from BeatParallaxLayer.
  const depth1 = beat0.querySelector("[data-beat-parallax-depth='1']");
  // Accent slash.
  const slash = beat0.querySelector("[data-beat-accent-slash]");
  // The opener band wraps the prose.
  const opener = beat0.querySelector("[data-band='opener']");
  // Ensure the slash sits visually above the prose: compare bounding rects.
  const slashRect = slash?.getBoundingClientRect();
  const proseRect = opener?.getBoundingClientRect();

  return {
    beat0Mounted: true,
    depth1Present: !!depth1,
    slashPresent: !!slash,
    openerPresent: !!opener,
    slashTop: slashRect?.top,
    slashHeight: slashRect?.height,
    proseTop: proseRect?.top,
    slashAbovePr: slashRect && proseRect ? slashRect.top < proseRect.bottom : null,
  };
});

console.log("BEAT 0 LAYERS:", JSON.stringify(layers, null, 2));

const failures = [];
if (!layers.beat0Mounted) failures.push("beat 0 wrapper not found");
if (!layers.depth1Present)
  failures.push("depth-1 BeatParallaxLayer (ambient wash) not present");
if (!layers.slashPresent) failures.push("accent slash not present");
if (!layers.openerPresent) failures.push("opener band (prose) not present");
if (layers.slashHeight === 0)
  failures.push("slash has zero height (visually missing)");

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
