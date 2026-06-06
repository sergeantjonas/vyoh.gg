// Probe: investigate the ~10-20px of unnecessary scroll at the end of
// the conclusion chapter. Map the chapter's scroll runway, beat dwell
// ranges, and where the chapter actually unpins.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });
await page.waitForSelector("[data-recap-chapter='conclusion']");

// Get conclusion chapter geometry first.
const geo = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='conclusion']");
  const section = root?.querySelector("[data-chapter-multi-beat]");
  const stage = root?.querySelector("[data-chapter-stage]");
  const track = root?.querySelector("[data-chapter-track]");
  const main = document.querySelector("main");
  if (!root || !section || !stage || !track || !main) return null;
  return {
    viewportHeight: window.innerHeight,
    mainHeight: main.clientHeight,
    mainScrollHeight: main.scrollHeight,
    sectionHeightPx: section.getBoundingClientRect().height,
    sectionTopBeforeScroll: section.getBoundingClientRect().top,
    stageRect: stage.getBoundingClientRect(),
    trackRect: track.getBoundingClientRect(),
  };
});
console.log("INITIAL GEOMETRY:");
console.log(JSON.stringify(geo, null, 2));

// Scroll to bottom of page and record progression.
const samples = [];
const main = await page.evaluate(() => {
  const m = document.querySelector("main");
  return m ? m.scrollHeight : 0;
});
console.log(`\nmain.scrollHeight = ${main}`);

// Sample around the conclusion's scroll range.
const initialMainTop = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='conclusion']");
  const main = document.querySelector("main");
  if (!root || !main) return null;
  return root.getBoundingClientRect().top + main.scrollTop;
});
console.log(`conclusion chapter starts at main scrollTop = ${initialMainTop}`);
console.log(`conclusion chapter height = ${geo.sectionHeightPx}`);
console.log(
  `conclusion chapter ends at main scrollTop = ${initialMainTop + geo.sectionHeightPx}`,
);
console.log(`page total scrollable = ${main}`);

// Step through scroll positions across the conclusion's range.
const stepPx = 100;
const start = initialMainTop;
const end = Math.min(initialMainTop + geo.sectionHeightPx + 200, main - 900);
for (let scrollTop = start; scrollTop <= end; scrollTop += stepPx) {
  await page.evaluate((y) => {
    const m = document.querySelector("main");
    if (m) m.scrollTo({ top: y, behavior: "instant" });
  }, scrollTop);
  await page.waitForTimeout(80);
  const sample = await page.evaluate(() => {
    const root = document.querySelector("[data-recap-chapter='conclusion']");
    const stage = root?.querySelector("[data-chapter-stage]");
    const track = root?.querySelector("[data-chapter-track]");
    const lastBeat = root?.querySelector("[data-beat='3']");
    const main = document.querySelector("main");
    if (!root || !stage || !main) return null;
    return {
      mainScrollTop: main.scrollTop,
      sectionTop: root.getBoundingClientRect().top,
      stageTop: stage.getBoundingClientRect().top,
      stageBottom: stage.getBoundingClientRect().bottom,
      stagePosition: window.getComputedStyle(stage).position,
      trackTransform: track ? window.getComputedStyle(track).transform : null,
      lastBeatLeft: lastBeat?.getBoundingClientRect().left,
      lastBeatBottom: lastBeat?.getBoundingClientRect().bottom,
    };
  });
  samples.push({ requested: scrollTop, ...sample });
}

console.log("\nSCROLL SAMPLES across conclusion:");
console.log("(requested = our scroll target, mainScrollTop = where main actually is)");
for (const s of samples) {
  const transform =
    s.trackTransform && s.trackTransform !== "none"
      ? s.trackTransform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+),/)?.[1] ?? "?"
      : "0";
  console.log(
    `  req=${s.requested.toString().padStart(6)} | actual=${s.mainScrollTop.toString().padStart(6)} | sectionTop=${s.sectionTop?.toFixed(0).padStart(6)} | stageTop=${s.stageTop?.toFixed(0).padStart(4)} stageBot=${s.stageBottom?.toFixed(0).padStart(4)} pos=${s.stagePosition} | trackX=${typeof transform === "string" ? transform.trim().padStart(8) : transform} | beat3.bottom=${s.lastBeatBottom?.toFixed(0)}`,
  );
}

await browser.close();
