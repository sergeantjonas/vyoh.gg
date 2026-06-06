// Probe: verify the multi-beat chapter respects prefers-reduced-motion.
//
// Expected behavior under reduced motion:
// - Beats render as a vertical stack (no sticky stage, no horizontal track)
// - data-reduced-motion attribute present on the chapter section
// - EditorialChrome is NOT rendered (carousel page chrome has no meaning
//   when beats stack vertically)
// - Slash + parallax primitives still render but at static end-state
//   (no scroll-coupled motion)
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

const audit = await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  const hasReducedMotionAttr = chapter?.hasAttribute("data-reduced-motion");
  const stage = chapter?.querySelector("[data-chapter-stage]");
  const track = chapter?.querySelector("[data-chapter-track]");
  const chrome = chapter?.querySelector("[data-editorial-chrome]");
  const slash = chapter?.querySelector("[data-beat-accent-slash]");
  const slashStyle = slash ? window.getComputedStyle(slash) : null;
  return {
    hasReducedMotionAttr,
    stagePresent: !!stage,
    trackPresent: !!track,
    chromePresent: !!chrome,
    slashPresent: !!slash,
    slashTransform: slashStyle?.transform ?? null,
  };
});

console.log("REDUCED-MOTION AUDIT:", JSON.stringify(audit, null, 2));

const failures = [];
if (!audit.hasReducedMotionAttr)
  failures.push(
    "expected data-reduced-motion attribute on chapter under reducedMotion=reduce"
  );
if (audit.stagePresent)
  failures.push("sticky stage should NOT render under reduced motion (was present)");
if (audit.trackPresent)
  failures.push("horizontal track should NOT render under reduced motion (was present)");
if (audit.chromePresent)
  failures.push("editorial chrome should NOT render under reduced motion (was present)");
if (!audit.slashPresent)
  failures.push("slash should still render under reduced motion (static end-state)");

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
