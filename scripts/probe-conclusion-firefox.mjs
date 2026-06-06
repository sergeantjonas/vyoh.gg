// Probe: Firefox-specific verification of the conclusion scroll fix.
// Motion's `useScroll` uses the native ScrollTimeline API on
// Chromium 115+ / Safari 26+ but falls back to rAF polling on Firefox,
// and the rAF fallback doesn't always update scrollYProgress from
// programmatic scrollTo until real scroll events fire (memory:
// feedback_motion_usescroll_firefox_programmatic). Different scroll-
// progress code path = different observable behavior.
import { firefox } from "playwright";

const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });
await page.waitForSelector("[data-recap-chapter='conclusion']");

// Wheel-event scroll instead of scrollTo, since the Firefox rAF
// useScroll only updates from real scroll events.
const main = await page.$("main");
if (!main) throw new Error("no main");

const geo = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='conclusion']");
  const section = root?.querySelector("[data-chapter-multi-beat]");
  const m = document.querySelector("main");
  if (!root || !section || !m) return null;
  return {
    viewportHeight: window.innerHeight,
    startMainScroll: root.getBoundingClientRect().top + m.scrollTop,
    sectionHeight: section.getBoundingClientRect().height,
    pageScrollHeight: m.scrollHeight,
    mainHeight: m.clientHeight,
  };
});
console.log("CONCLUSION GEOMETRY (Firefox):");
console.log(JSON.stringify(geo, null, 2));
console.log(
  `\nChapter occupies main.scrollTop [${geo.startMainScroll}, ${geo.startMainScroll + geo.sectionHeight}]`,
);

// Scroll into the conclusion via wheel events, then keep wheeling and
// sampling. Wheel events should trigger Motion's rAF fallback to update.
await page.mouse.move(720, 450); // hover over main
await page.evaluate((target) => {
  const m = document.querySelector("main");
  if (m) m.scrollTo({ top: target, behavior: "instant" });
}, geo.startMainScroll - 100);
await page.waitForTimeout(800);
console.log("Positioned just above conclusion. Now wheeling forward in steps...");

const samples = [];
const stepDeltaY = 200;
for (let i = 0; i < 50; i += 1) {
  await page.mouse.wheel(0, stepDeltaY);
  await page.waitForTimeout(120);
  const s = await page.evaluate(() => {
    const root = document.querySelector("[data-recap-chapter='conclusion']");
    const track = root?.querySelector("[data-chapter-track]");
    const stage = root?.querySelector("[data-chapter-stage]");
    const m = document.querySelector("main");
    if (!root || !track || !stage || !m) return null;
    const tf = window.getComputedStyle(track).transform;
    const tx =
      tf && tf !== "none" ? Number.parseFloat(tf.split(",")[4]?.trim() ?? "0") : 0;
    return {
      mainScroll: m.scrollTop,
      trackX: tx,
      sectionTop: root.getBoundingClientRect().top,
      stagePos: window.getComputedStyle(stage).position,
      stageBottom: stage.getBoundingClientRect().bottom,
      atPageBottom: m.scrollTop + m.clientHeight >= m.scrollHeight - 2,
    };
  });
  samples.push(s);
}

console.log("\nScroll trail (Firefox, wheel deltaY=200 per step):");
let prev = null;
let trackSettleAt = null;
for (const s of samples) {
  const sticky = s.stagePos === "sticky" ? "STK" : "stc";
  const bot = s.atPageBottom ? "AT-PAGE-BOTTOM" : "";
  console.log(
    `  scroll=${s.mainScroll.toString().padStart(6)} trackX=${s.trackX.toFixed(0).padStart(6)} stageBot=${s.stageBottom.toFixed(0).padStart(4)} ${sticky} ${bot}`,
  );
  if (
    prev !== null &&
    Math.abs(s.trackX - prev.trackX) < 1 &&
    !trackSettleAt &&
    s.trackX < -4000
  ) {
    trackSettleAt = s.mainScroll;
  }
  prev = s;
}

const last = samples[samples.length - 1];
console.log(`\nFinal trackX = ${last?.trackX}`);
console.log(`Final mainScroll = ${last?.mainScroll}`);
console.log(`Track settled at mainScroll = ${trackSettleAt ?? "(still moving)"}`);
if (trackSettleAt && last) {
  console.log(`Post-settle scroll = ${last.mainScroll - trackSettleAt}px`);
}

await browser.close();
