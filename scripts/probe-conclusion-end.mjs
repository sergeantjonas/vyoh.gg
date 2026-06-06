// Focused probe on the END of the conclusion chapter — where is the
// post-beat-3 dwell stretch, how much pixel scroll happens without any
// visual change?
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });
await page.waitForSelector("[data-recap-chapter='conclusion']");

const geo = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='conclusion']");
  const section = root?.querySelector("[data-chapter-multi-beat]");
  const main = document.querySelector("main");
  if (!root || !section || !main) return null;
  const startMainScroll = root.getBoundingClientRect().top + main.scrollTop;
  const sectionHeight = section.getBoundingClientRect().height;
  return {
    viewportHeight: window.innerHeight,
    startMainScroll,
    sectionHeight,
    endMainScroll: startMainScroll + sectionHeight,
    pageScrollHeight: main.scrollHeight,
    pageScrollHeightVps: main.scrollHeight / window.innerHeight,
    conclusionHeightVps: sectionHeight / window.innerHeight,
  };
});
console.log("CONCLUSION GEOMETRY:");
console.log(JSON.stringify(geo, null, 2));

// Step the LAST 1500px of the chapter (where the beat 3 dwell + unpin
// happens) and find where trackX stops changing.
const stepPx = 50;
let lastTrackX = null;
let trackStopFromMain = null;
const samples = [];
for (
  let scroll = geo.endMainScroll - 1500;
  scroll <= geo.endMainScroll + 200;
  scroll += stepPx
) {
  await page.evaluate((y) => {
    const m = document.querySelector("main");
    if (m) m.scrollTo({ top: y, behavior: "instant" });
  }, scroll);
  await page.waitForTimeout(50);
  const s = await page.evaluate(() => {
    const root = document.querySelector("[data-recap-chapter='conclusion']");
    const track = root?.querySelector("[data-chapter-track]");
    const stage = root?.querySelector("[data-chapter-stage]");
    const main = document.querySelector("main");
    if (!root || !track || !stage || !main) return null;
    const transform = window.getComputedStyle(track).transform;
    const tx =
      transform && transform !== "none"
        ? Number.parseFloat(transform.split(",")[4]?.trim() ?? "0")
        : 0;
    return {
      mainScroll: main.scrollTop,
      trackX: tx,
      sectionTop: root.getBoundingClientRect().top,
      stagePosition: window.getComputedStyle(stage).position,
      stageBottom: stage.getBoundingClientRect().bottom,
    };
  });
  samples.push(s);
  if (lastTrackX !== null && s.trackX === lastTrackX && trackStopFromMain === null) {
    trackStopFromMain = s.mainScroll;
  }
  lastTrackX = s.trackX;
}

console.log(
  "\nSCROLL trail (last 1500px before chapter end + 200px past, step 50px):",
);
for (const s of samples) {
  const sticky = s.stagePosition === "sticky" ? "STICKY" : "static";
  console.log(
    `  mainScroll=${s.mainScroll.toString().padStart(6)} trackX=${s.trackX.toFixed(0).padStart(6)} sectionTop=${s.sectionTop?.toFixed(0).padStart(6)} stageBot=${s.stageBottom?.toFixed(0).padStart(4)} ${sticky}`,
  );
}

// Compute "wasted scroll" = distance between first sample where trackX
// settles vs end of chapter.
let lastChangedIdx = -1;
for (let i = 1; i < samples.length; i += 1) {
  if (Math.abs(samples[i].trackX - samples[i - 1].trackX) > 1) {
    lastChangedIdx = i;
  }
}
if (lastChangedIdx >= 0) {
  const lastChangedScroll = samples[lastChangedIdx].mainScroll;
  const lastSampleScroll = samples[samples.length - 1].mainScroll;
  const finalSticky = samples[samples.length - 1].stagePosition;
  console.log(`\nTrack last advanced at mainScroll=${lastChangedScroll}`);
  console.log(`Probe ended at mainScroll=${lastSampleScroll}`);
  console.log(
    `Post-track-settle scroll distance = ${lastSampleScroll - lastChangedScroll}px`,
  );
  console.log(`Chapter still sticky at end: ${finalSticky === "sticky"}`);
}

await browser.close();
