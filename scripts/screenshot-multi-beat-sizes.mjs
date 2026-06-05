// Multi-viewport screenshot probe to reproduce the "invisible at full size"
// symptom on MacBook screens.

import { chromium } from "playwright";

const SIZES = [
  { width: 1440, height: 900, label: "MBP-13" },
  { width: 1728, height: 1117, label: "MBP-16" },
  { width: 1920, height: 1200, label: "MBP-16-scaled" },
  { width: 2560, height: 1440, label: "MBP-16-native-2x-virtual" },
];

const browser = await chromium.launch({ headless: true });

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  await page.goto("http://localhost:2009/?layout=multi-beat", {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("[data-chapter-multi-beat]");

  // Scroll into the first multi-beat chapter
  await page.evaluate(() => {
    const chapter = document.querySelector("[data-chapter-multi-beat]");
    const main = document.querySelector("main");
    if (chapter && main) {
      const top = chapter.getBoundingClientRect().top + main.scrollTop;
      main.scrollTo({ top, behavior: "instant" });
    }
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `/tmp/multi-beat-${size.label}.png`,
    fullPage: false,
  });

  const geom = await page.evaluate(() => {
    const masthead = document.querySelector("header[data-chapter-masthead]");
    const track = document.querySelector("[data-chapter-track]");
    const beats = Array.from(
      document.querySelectorAll("[data-chapter-multi-beat] [data-beat]")
    );
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      mastheadRect: masthead?.getBoundingClientRect(),
      trackRect: track?.getBoundingClientRect(),
      beat0Rect: beats[0]?.getBoundingClientRect(),
      beat0HasContent: (beats[0]?.textContent ?? "").trim().length > 0,
      // What's at the center of where beat 0 should be?
      atBeat0Center: (() => {
        if (!beats[0]) return null;
        const r = beats[0].getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const el = document.elementFromPoint(x, y);
        return {
          x,
          y,
          tag: el?.tagName,
          className: el?.className?.slice?.(0, 80),
          dataAttrs: el ? Array.from(el.attributes).filter((a) => a.name.startsWith("data-")).map((a) => a.name) : null,
        };
      })(),
    };
  });
  console.log(`\n=== ${size.label} (${size.width}x${size.height}) ===`);
  console.log(JSON.stringify(geom, null, 2));
  await ctx.close();
}

await browser.close();
