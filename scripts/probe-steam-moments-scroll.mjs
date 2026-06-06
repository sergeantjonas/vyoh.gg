// Probe: sample the Steam moments aggregator layout at multiple scroll
// positions to find where the user's screenshot is from. Capture
// screenshots at each position too.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });

const stops = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
for (const t of stops) {
  await page.evaluate((f) => {
    const root = document.querySelector("[data-recap-chapter='steam-moments']");
    const main = document.querySelector("main");
    if (!root || !main) return;
    const rect = root.getBoundingClientRect();
    const top = rect.top + main.scrollTop + rect.height * f;
    main.scrollTo({ top, behavior: "instant" });
  }, t);
  await page.waitForTimeout(400);
  const snap = await page.evaluate(() => {
    const root = document.querySelector("[data-recap-chapter='steam-moments']");
    if (!root) return null;
    const track = root.querySelector("[data-chapter-track]");
    const beat0 = root.querySelector("[data-beat='0']");
    const masthead = root.querySelector("[data-chapter-masthead]");
    return {
      trackTransform: track ? window.getComputedStyle(track).transform : null,
      beat0Left: beat0?.getBoundingClientRect().left,
      beat0Right: beat0?.getBoundingClientRect().right,
      mastheadLeft: masthead?.getBoundingClientRect().left,
      mastheadRight: masthead?.getBoundingClientRect().right,
    };
  });
  console.log(`progress=${t}:`, JSON.stringify(snap));
  await page.screenshot({
    path: `/tmp/steam-moments-${t}.png`,
    fullPage: false,
  });
}

await browser.close();
console.log("\nScreenshots saved to /tmp/steam-moments-{progress}.png");
