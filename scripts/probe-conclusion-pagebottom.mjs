// Probe: investigate whether there's any visual scroll happening between
// "beat 3 fully visible" and "page bottom reached" in Firefox.
// Takes screenshots at boundary points.
import { firefox } from "playwright";

const browser = await firefox.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });
await page.waitForSelector("[data-recap-chapter='conclusion']");

const geo = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='conclusion']");
  const section = root?.querySelector("[data-chapter-multi-beat]");
  const m = document.querySelector("main");
  if (!root || !section || !m) return null;
  const cssMainH = getComputedStyle(document.documentElement).getPropertyValue("--main-h");
  return {
    viewportHeight: window.innerHeight,
    mainHeight: m.clientHeight,
    mainScrollHeight: m.scrollHeight,
    cssMainH,
    startMainScroll: root.getBoundingClientRect().top + m.scrollTop,
    sectionHeight: section.getBoundingClientRect().height,
    sectionEnd: root.getBoundingClientRect().top + m.scrollTop + section.getBoundingClientRect().height,
    maxScroll: m.scrollHeight - m.clientHeight,
  };
});
console.log("GEOMETRY:");
console.log(JSON.stringify(geo, null, 2));
console.log(
  `\nConclusion section [${geo.startMainScroll}, ${geo.sectionEnd}], max scroll = ${geo.maxScroll}`,
);
console.log(`Gap between section end and max scroll: ${geo.sectionEnd - geo.maxScroll}px`);

// Scroll directly to max scroll (page bottom) and check what's visible.
await page.evaluate((y) => {
  const m = document.querySelector("main");
  if (m) m.scrollTo({ top: y, behavior: "instant" });
}, geo.maxScroll);
await page.waitForTimeout(500);

const atBottom = await page.evaluate(() => {
  const root = document.querySelector("[data-recap-chapter='conclusion']");
  const track = root?.querySelector("[data-chapter-track]");
  const stage = root?.querySelector("[data-chapter-stage]");
  const beat3 = root?.querySelector("[data-beat='3']");
  const m = document.querySelector("main");
  if (!root || !track || !stage || !beat3 || !m) return null;
  const tf = window.getComputedStyle(track).transform;
  const tx =
    tf && tf !== "none" ? Number.parseFloat(tf.split(",")[4]?.trim() ?? "0") : 0;
  return {
    mainScroll: m.scrollTop,
    trackX: tx,
    sectionTop: root.getBoundingClientRect().top,
    sectionBottom: root.getBoundingClientRect().bottom,
    stageTop: stage.getBoundingClientRect().top,
    stageBot: stage.getBoundingClientRect().bottom,
    beat3Top: beat3.getBoundingClientRect().top,
    beat3Bot: beat3.getBoundingClientRect().bottom,
    stagePos: window.getComputedStyle(stage).position,
  };
});
console.log("\nAT PAGE BOTTOM (mainScroll = maxScroll):");
console.log(JSON.stringify(atBottom, null, 2));
await page.screenshot({ path: "/tmp/conclusion-at-bottom.png", fullPage: false });

// Now scroll just BEFORE max scroll (50px earlier) and check.
await page.evaluate(
  (y) => {
    const m = document.querySelector("main");
    if (m) m.scrollTo({ top: y, behavior: "instant" });
  },
  geo.maxScroll - 50,
);
await page.waitForTimeout(500);

const before = await page.evaluate(() => {
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
    sectionBottom: root.getBoundingClientRect().bottom,
    stageTop: stage.getBoundingClientRect().top,
    stageBot: stage.getBoundingClientRect().bottom,
  };
});
console.log("\nAT mainScroll = maxScroll - 50:");
console.log(JSON.stringify(before, null, 2));

console.log("\nDelta from before to atBottom:");
if (before && atBottom) {
  console.log(`  trackX: ${before.trackX.toFixed(0)} -> ${atBottom.trackX.toFixed(0)} (Δ${(atBottom.trackX - before.trackX).toFixed(1)})`);
  console.log(`  sectionTop: ${before.sectionTop.toFixed(0)} -> ${atBottom.sectionTop.toFixed(0)} (Δ${(atBottom.sectionTop - before.sectionTop).toFixed(1)})`);
  console.log(`  stageTop: ${before.stageTop.toFixed(0)} -> ${atBottom.stageTop.toFixed(0)} (Δ${(atBottom.stageTop - before.stageTop).toFixed(1)})`);
  console.log(`  stageBot: ${before.stageBot.toFixed(0)} -> ${atBottom.stageBot.toFixed(0)} (Δ${(atBottom.stageBot - before.stageBot).toFixed(1)})`);
}

await browser.close();
console.log("\nScreenshot at page bottom saved to /tmp/conclusion-at-bottom.png");
