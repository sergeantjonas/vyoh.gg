// Chunk-2 verification probe — checks that the `?layout=multi-beat` URL flag
// switches the Steam chapter to the new multi-beat architecture.
//
// Navigates twice:
//   1. http://localhost:2009/ (legacy path expected — [data-chapter-group])
//   2. http://localhost:2009/?layout=multi-beat (new path — [data-chapter-multi-beat])
// Reports which structural attributes are found on each page.
//
// Run a dev server on :2009 first, then: node scripts/diagnose-multi-beat-flag.mjs

import { chromium } from "playwright";

const BASE = process.env.URL || "http://localhost:2009/";
const VIEWPORT = { width: 1280, height: 720 };

async function probe(page, url, label) {
  console.log(`\n=== ${label} ===\n${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });

  // Wait for the Steam chapter to mount — gated by data fetch.
  // Try both chapter wrapper attrs; whichever appears first is the active path.
  try {
    await page.waitForSelector(
      "[data-chapter-group], [data-chapter-multi-beat]",
      { timeout: 8_000 }
    );
  } catch {
    console.log("✗ neither chapter wrapper appeared within 8s");
    return;
  }

  const findings = await page.evaluate(() => {
    const legacy = document.querySelector("[data-chapter-group]");
    const multi = document.querySelector("[data-chapter-multi-beat]");
    const masthead = document.querySelector("header[data-chapter-masthead]");
    const beats = Array.from(document.querySelectorAll("[data-beat]"));
    const sample = beats[0];
    return {
      legacyPresent: !!legacy,
      multiPresent: !!multi,
      legacyBeatCount: legacy?.getAttribute("data-chapter-beat-count") ?? null,
      multiBeatCount: multi?.getAttribute("data-chapter-beat-count") ?? null,
      mastheadIsHeader: !!masthead,
      mastheadIsSticky: masthead?.className.includes("sticky") ?? false,
      mastheadHeight: multi?.style.getPropertyValue("--masthead-h") ?? null,
      beatNodeCount: beats.length,
      sampleBeatClass: sample?.className ?? null,
      sampleHasSnapAlign:
        sample?.className.includes("scroll-snap-align:start") ?? false,
      sampleHasSnapStop:
        sample?.className.includes("scroll-snap-stop:always") ?? false,
      sampleHasScrollMargin:
        sample?.className.includes("scroll-margin-top:var(--masthead-h)") ?? false,
    };
  });

  console.log(JSON.stringify(findings, null, 2));
  return findings;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

const legacy = await probe(page, BASE, "LEGACY (no flag)");
const multi = await probe(page, `${BASE}?layout=multi-beat`, "MULTI-BEAT FLAG ON");

await browser.close();

// Verdict
console.log("\n=== VERDICT ===");
const legacyOk =
  legacy?.legacyPresent && !legacy?.multiPresent && legacy?.legacyBeatCount === "4";
const multiOk =
  multi?.multiPresent &&
  !multi?.legacyPresent &&
  multi?.multiBeatCount === "4" &&
  multi?.mastheadIsHeader &&
  multi?.mastheadIsSticky &&
  multi?.sampleHasSnapAlign &&
  multi?.sampleHasSnapStop &&
  multi?.sampleHasScrollMargin;

console.log(`Legacy path: ${legacyOk ? "✓ OK" : "✗ FAILED"}`);
console.log(`Multi-beat path: ${multiOk ? "✓ OK" : "✗ FAILED"}`);
process.exit(legacyOk && multiOk ? 0 : 1);
