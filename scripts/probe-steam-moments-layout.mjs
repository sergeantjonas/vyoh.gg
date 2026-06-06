// Probe: investigate the broken Steam moments aggregator layout. User
// screenshot shows beat content clipped to the left of the viewport,
// masthead shifted right. Check the multi-beat track geometry +
// horizontal positions at beat 0.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });

// Scroll the Steam moments aggregator to its top (beat 0 active).
await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='steam-moments']");
  const main = document.querySelector("main");
  if (!root || !main) return;
  const rect = root.getBoundingClientRect();
  main.scrollTo({ top: rect.top + main.scrollTop, behavior: "instant" });
});
await page.waitForTimeout(500);

const layout = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='steam-moments']");
  if (!root) return null;
  const section = root.querySelector("[data-chapter-multi-beat]");
  const stage = root.querySelector("[data-chapter-stage]");
  const track = root.querySelector("[data-chapter-track]");
  const masthead = root.querySelector("[data-chapter-masthead]");
  const beat0 = root.querySelector("[data-beat='0']");
  const beat1 = root.querySelector("[data-beat='1']");
  const rect = (el) =>
    el
      ? {
          left: el.getBoundingClientRect().left,
          right: el.getBoundingClientRect().right,
          width: el.getBoundingClientRect().width,
        }
      : null;
  return {
    viewportWidth: window.innerWidth,
    section: rect(section),
    sectionStyleWidth: section?.style.width,
    sectionMarginLeft: section?.style.marginLeft,
    stage: rect(stage),
    track: rect(track),
    trackStyleX: track?.style.transform,
    trackStyleWidth: track?.style.width,
    masthead: rect(masthead),
    beat0: rect(beat0),
    beat0StyleWidth: beat0?.style.width,
    beat1: rect(beat1),
    beat1StyleWidth: beat1?.style.width,
  };
});

console.log("STEAM MOMENTS LAYOUT @ beat 0:");
console.log(JSON.stringify(layout, null, 2));

await browser.close();
