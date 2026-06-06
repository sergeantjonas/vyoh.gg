// Probe: beat 0 (verdict) renders the slash + prose composition and
// that the accent slash is positioned in flow above the prose. (An
// earlier depth-1 ambient wash was pulled after the first taste pass —
// fought the splash's own atmospherics. The probe no longer checks for
// it.) Editorial chrome verified separately in probe-editorial-chrome.
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
  const beat0 = document.querySelector("[data-chapter-multi-beat] [data-beat='0']");
  if (!beat0) return { beat0Mounted: false };

  // Accent slash.
  const slash = beat0.querySelector("[data-beat-accent-slash]");
  // The opener band wraps the prose.
  const opener = beat0.querySelector("[data-band='opener']");
  const slashRect = slash?.getBoundingClientRect();
  const proseRect = opener?.getBoundingClientRect();

  return {
    beat0Mounted: true,
    slashPresent: !!slash,
    openerPresent: !!opener,
    slashTop: slashRect?.top,
    slashHeight: slashRect?.height,
    proseTop: proseRect?.top,
  };
});

console.log("BEAT 0 LAYERS:", JSON.stringify(layers, null, 2));

const failures = [];
if (!layers.beat0Mounted) failures.push("beat 0 wrapper not found");
if (!layers.slashPresent) failures.push("accent slash not present");
if (!layers.openerPresent) failures.push("opener band (prose) not present");
if (layers.slashHeight === 0) failures.push("slash has zero height (visually missing)");

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
