// Probe: verify the verdict prose top position relative to the
// masthead bottom. After moving the slash from above-prose to
// below-prose, the prose top should sit ~32px below the masthead
// (just the band's pt-8 padding, no slash gap).
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/?layout=multi-beat", {
  waitUntil: "networkidle",
});
await page.waitForSelector("[data-chapter-multi-beat]");

await page.evaluate(() => {
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter) return;
  const main = document.querySelector("main");
  if (!main) return;
  const top = chapter.getBoundingClientRect().top + main.scrollTop;
  main.scrollTo({ top, behavior: "instant" });
});
await page.waitForTimeout(500);

const geom = await page.evaluate(() => {
  const masthead = document.querySelector(
    "[data-chapter-multi-beat] header[data-chapter-masthead]"
  );
  const beat0 = document.querySelector("[data-chapter-multi-beat] [data-beat='0']");
  const opener = beat0?.querySelector("[data-band='opener']");
  const prose = opener?.querySelector("p");
  const slash = beat0?.querySelector("[data-beat-accent-slash]");

  const mastheadRect = masthead?.getBoundingClientRect();
  const openerRect = opener?.getBoundingClientRect();
  const proseRect = prose?.getBoundingClientRect();
  const slashRect = slash?.getBoundingClientRect();

  return {
    mastheadBottom: mastheadRect?.bottom,
    openerTop: openerRect?.top,
    proseTop: proseRect?.top,
    slashTop: slashRect?.top,
    gapMastheadToProse:
      proseRect && mastheadRect ? proseRect.top - mastheadRect.bottom : null,
    slashBelowProse: slashRect && proseRect ? slashRect.top > proseRect.bottom : null,
  };
});

console.log("BEAT 0 GEOMETRY:", JSON.stringify(geom, null, 2));

const failures = [];
if (!geom.slashBelowProse)
  failures.push("expected slash to sit below the prose, but it's above");
if (geom.gapMastheadToProse !== null && geom.gapMastheadToProse > 120)
  failures.push(
    `gap from masthead bottom to prose top is ${geom.gapMastheadToProse}px, expected ≤ 120 (band padding ~32 + a small breath)`
  );

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
