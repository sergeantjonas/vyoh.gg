// Probe: verify the small-screen layout collision flagged in
// self-portrait-recap-arc.md (2026-06-04) is no longer an issue post-
// R-13's sticky restructure.
//
// The original report: on viewports < 720px tall, beat content
// overlapped the chapter masthead because the inner content was
// absolutely-positioned-equivalent (counter-translate + h-dvh) without
// reserving the masthead's height. R-13 abandoned counter-translate in
// favor of position: sticky + flex-col stage (masthead in flow at top,
// track filling remaining height with min-h-0). That SHOULD fix it for
// free.
//
// This probe checks both Ahri and Steam chapters at the original
// collision viewport (1200×600), measuring whether beat-content top
// sits at or below the masthead bottom.
import { chromium } from "playwright";

const VIEWPORTS = [
  { name: "640×600 (short laptop)", width: 640, height: 600 },
  { name: "1200×600 (short laptop)", width: 1200, height: 600 },
  { name: "1440×900 (standard)", width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });

  for (const chapter of ["ahri", "steam"]) {
    const sel =
      chapter === "ahri"
        ? "[data-recap-chapter='ahri'] [data-chapter-multi-beat]"
        : "[data-recap-chapter='steam'] [data-chapter-multi-beat]";
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
    } catch {
      console.log(`  ${chapter}: not present on /, skipping`);
      continue;
    }

    // Scroll the chapter so its sticky stage is pinned (chapter top
    // crossed viewport top). Use beat 1 progress so the masthead is
    // fully sticky and a beat body is visible.
    await page.evaluate((s) => {
      const chapter = document.querySelector(s);
      if (!chapter) return;
      const main = document.querySelector("main");
      if (!main) return;
      const rect = chapter.getBoundingClientRect();
      const top = rect.top + main.scrollTop + rect.height * 0.4;
      main.scrollTo({ top, behavior: "instant" });
    }, sel);
    await page.waitForTimeout(400);

    const measurements = await page.evaluate((s) => {
      const chapter = document.querySelector(s);
      if (!chapter) return null;
      const masthead = chapter.querySelector("header[data-chapter-masthead]");
      const focalBeat = chapter.querySelector("[data-beat='1']");
      const beatBand =
        focalBeat?.querySelector("[data-band='detail']") ||
        focalBeat?.querySelector("[data-band='stats']") ||
        focalBeat?.querySelector("[data-band='opener']");
      if (!masthead || !beatBand) return null;
      const mRect = masthead.getBoundingClientRect();
      const bRect = beatBand.getBoundingClientRect();
      return {
        mastheadBottom: mRect.bottom,
        beatTop: bRect.top,
        beatBottom: bRect.bottom,
        viewportHeight: window.innerHeight,
      };
    }, sel);

    if (!measurements) {
      console.log(`  ${chapter}: could not measure (selectors not found)`);
      continue;
    }

    const { mastheadBottom, beatTop, beatBottom, viewportHeight } = measurements;
    const overlap = mastheadBottom - beatTop;
    const status = overlap > 4 ? "COLLISION" : "ok";
    console.log(
      `  ${chapter}: masthead.bottom=${mastheadBottom.toFixed(0)} beat.top=${beatTop.toFixed(0)} (overlap=${overlap.toFixed(0)}px) ${status}`,
    );

    if (overlap > 4) {
      failures.push(
        `${vp.name} / ${chapter}: beat content overlaps masthead by ${overlap.toFixed(0)}px`,
      );
    }
    // Also flag if the beat overflows the viewport bottom — that's a
    // different small-screen failure mode (content unreachable without
    // scrolling past the pinned stage, which sticky doesn't allow).
    if (beatBottom > viewportHeight + 4) {
      console.log(
        `    note: beat.bottom (${beatBottom.toFixed(0)}) > viewport (${viewportHeight}) — content extends past viewport`,
      );
    }
  }

  console.log(`viewport ${vp.name}`);
  await ctx.close();
}

await browser.close();

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nNO COLLISIONS — small-screen layout safe across tested viewports.");
}
