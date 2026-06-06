// Probe: verify both moment aggregators render with the dev-override data.
//
// DEV_LOL_MOMENT_OVERRIDE seeds 6 LoL moments (one per momentType);
// DEV_STEAM_MOMENT_OVERRIDE seeds 2 Steam moments. The aggregators should
// each pin once with the correct masthead identity + beat count.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });

// LoL moments aggregator
await page.waitForSelector("[data-recap-chapter='lol-moments']", { timeout: 5000 });
const lol = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='lol-moments']");
  if (!root) return null;
  const multiBeat = root.querySelector("[data-chapter-multi-beat]");
  const masthead = root.querySelector("[data-chapter-masthead]");
  return {
    beatCount: multiBeat?.getAttribute("data-chapter-beat-count") ?? null,
    mastheadText: masthead?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    h2: masthead?.querySelector("h2")?.textContent ?? null,
    firstBeatEyebrow: root
      .querySelector("[data-beat='0']")
      ?.textContent?.match(/Rank up|Off-meta pick|Standout game|Hot streak|Marathon|Return/)?.[0],
  };
});

// Steam moments aggregator
await page.waitForSelector("[data-recap-chapter='steam-moments']", { timeout: 5000 });
const steam = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='steam-moments']");
  if (!root) return null;
  const multiBeat = root.querySelector("[data-chapter-multi-beat]");
  const masthead = root.querySelector("[data-chapter-masthead]");
  return {
    beatCount: multiBeat?.getAttribute("data-chapter-beat-count") ?? null,
    mastheadText: masthead?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    h2: masthead?.querySelector("h2")?.textContent ?? null,
    firstBeatEyebrow: root
      .querySelector("[data-beat='0']")
      ?.textContent?.match(/First time on|Recent run on/)?.[0],
  };
});

console.log("LoL moments aggregator:");
console.log("  ", JSON.stringify(lol, null, 2));
console.log("\nSteam moments aggregator:");
console.log("  ", JSON.stringify(steam, null, 2));

const failures = [];
if (lol?.beatCount !== "6") failures.push(`LoL beat count expected 6, got ${lol?.beatCount}`);
if (lol?.h2 !== "Moments") failures.push(`LoL masthead H2 expected "Moments", got "${lol?.h2}"`);
if (steam?.beatCount !== "2")
  failures.push(`Steam beat count expected 2, got ${steam?.beatCount}`);
if (steam?.h2 !== "Highlights")
  failures.push(`Steam masthead H2 expected "Highlights", got "${steam?.h2}"`);

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nBOTH AGGREGATORS RENDER WITH DEV-OVERRIDE DATA");
}

await browser.close();
