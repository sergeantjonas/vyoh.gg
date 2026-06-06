// Probe: verify the alive-masthead progress line scales with chapter
// scroll progress — scaleX ~0 at chapter top, ~1 at chapter end, and
// stays anchored at the masthead's bottom edge throughout.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

const scrub = async (frac) => {
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

const readScaleX = async () => {
  return page.evaluate(() => {
    const line = document.querySelector(
      "[data-chapter-multi-beat] [data-chapter-masthead-progress]"
    );
    if (!line) return null;
    const style = window.getComputedStyle(line);
    const rect = line.getBoundingClientRect();
    const header = document.querySelector(
      "[data-chapter-multi-beat] header[data-chapter-masthead]"
    );
    const headerRect = header?.getBoundingClientRect();
    return {
      transform: style.transform,
      lineTop: rect.top,
      lineHeight: rect.height,
      headerBottom: headerRect?.bottom,
    };
  });
};

await scrub(0);
const atTop = await readScaleX();
console.log("AT CHAPTER PROGRESS 0%:", JSON.stringify(atTop, null, 2));

await scrub(0.5);
const atHalf = await readScaleX();
console.log("AT CHAPTER PROGRESS 50%:", JSON.stringify(atHalf, null, 2));

await scrub(0.95);
const atEnd = await readScaleX();
console.log("AT CHAPTER PROGRESS 95%:", JSON.stringify(atEnd, null, 2));

const parseScaleX = (t) => {
  if (!t || t === "none") return 1;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return 1;
  const parts = m[1].split(",").map((s) => Number.parseFloat(s.trim()));
  return parts[0] ?? 1;
};

const failures = [];
if (!atTop) failures.push("progress line not found");
const top = atTop ? parseScaleX(atTop.transform) : NaN;
const half = atHalf ? parseScaleX(atHalf.transform) : NaN;
const end = atEnd ? parseScaleX(atEnd.transform) : NaN;
console.log(`scaleX: top=${top}, half=${half}, end=${end}`);
if (top > 0.1) failures.push(`scaleX at chapter top should be ~0, got ${top}`);
if (half < 0.3 || half > 0.7)
  failures.push(`scaleX at 50% should be ~0.5, got ${half}`);
if (end < 0.85)
  failures.push(`scaleX at 95% should approach 1, got ${end}`);

// Line should sit AT the masthead's bottom edge.
if (atTop && Math.abs(atTop.lineTop + atTop.lineHeight - atTop.headerBottom) > 2)
  failures.push(
    `line is not at the header's bottom edge: line.bottom=${atTop.lineTop + atTop.lineHeight}, header.bottom=${atTop.headerBottom}`
  );

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
