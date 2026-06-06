// Probe: verify R-12.4 per-beat entrance variety actually renders.
//
// Two things to confirm in a real browser, not just via test assertions:
//
//   1. Ahri beat 1 signature game uses the new scale+blur+rise entrance,
//      NOT the old slideX=-40 pattern. At mid-animation the inline style
//      `transform` should show a non-1 scale and ty>0 (rise) with tx ≈ 0
//      (no slideX), and `filter` should include `blur(>0)`. The old shape
//      would have `tx ≈ -40` and no filter blur.
//
//   2. Ahri beat 1 recent-row entrance uses the new blur-dissolve, NOT
//      slideX=18. Each row should mid-animation show filter blur and tx
//      ≈ 0 (no horizontal slide), with ty > 0 (rise).
//
// Catches the case where ChapterReveal silently ignored a prop, or the
// prop name changed, or motion's variant target wasn't re-evaluated.
// Test assertions confirmed the JSX shape; this probe confirms the
// computed style.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });
await page.waitForSelector("[data-recap-chapter='ahri'] [data-chapter-multi-beat]");

const scrollChapterTo = async (frac) => {
  await page.evaluate((f) => {
    const chapter = document.querySelector(
      "[data-recap-chapter='ahri'] [data-chapter-multi-beat]"
    );
    if (!chapter) throw new Error("ahri chapter not found");
    const main = document.querySelector("main");
    if (!main) throw new Error("main not found");
    const rect = chapter.getBoundingClientRect();
    const top = rect.top + main.scrollTop + rect.height * f;
    main.scrollTo({ top, behavior: "instant" });
  }, frac);
};

// Parse `matrix(a, b, c, d, tx, ty)` → { sx, sy, tx, ty }. Pure scale +
// translate (motion's standard shape) has b = c = 0.
const parseMatrix = (t) => {
  if (!t || t === "none") return { sx: 1, sy: 1, tx: 0, ty: 0 };
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return { sx: 1, sy: 1, tx: 0, ty: 0 };
  const p = m[1].split(",").map((s) => Number.parseFloat(s.trim()));
  return { sx: p[0] ?? 1, sy: p[3] ?? 1, tx: p[4] ?? 0, ty: p[5] ?? 0 };
};

const parseBlurPx = (filter) => {
  if (!filter || filter === "none") return 0;
  const m = filter.match(/blur\(([\d.]+)px\)/);
  return m ? Number.parseFloat(m[1]) : 0;
};

// Scroll Ahri chapter such that beat 1 is the focal beat (~40% chapter
// progress under SCROLL_RUNWAY_MULTIPLIER=2.3 with 3 beats; tune if the
// in-view trigger doesn't fire).
await scrollChapterTo(0.42);
// Sample several times during the entrance so we catch a mid-animation
// frame. The entrance duration is ~0.85s for the signature game; 80ms
// after scrollTo should land safely inside the animation window.
const samples = [];
for (const delayMs of [80, 160, 320]) {
  await page.waitForTimeout(delayMs - (samples[samples.length - 1]?.atMs ?? 0));
  const snap = await page.evaluate(() => {
    const sigLink = document.querySelector(
      "[data-recap-chapter='ahri'] [data-beat='1'] [data-band='detail'] a[href*='/matches/']"
    );
    const sigMotion = sigLink?.parentElement; // ChapterReveal's m.div
    const rowMotion = document.querySelector(
      "[data-recap-chapter='ahri'] [data-beat='1'] [data-band='detail'] ul li > div"
    );
    const read = (el) =>
      el
        ? {
            transform: window.getComputedStyle(el).transform,
            filter: window.getComputedStyle(el).filter,
            opacity: window.getComputedStyle(el).opacity,
          }
        : null;
    return {
      signature: read(sigMotion),
      firstRow: read(rowMotion),
    };
  });
  samples.push({ atMs: delayMs, ...snap });
}

// Settled state — after the entrance fully completes everything should
// land at identity transform, no blur, opacity 1.
await page.waitForTimeout(1500);
const settled = await page.evaluate(() => {
  const sigLink = document.querySelector(
    "[data-recap-chapter='ahri'] [data-beat='1'] [data-band='detail'] a[href*='/matches/']"
  );
  const sigMotion = sigLink?.parentElement;
  const rowMotion = document.querySelector(
    "[data-recap-chapter='ahri'] [data-beat='1'] [data-band='detail'] ul li > div"
  );
  const read = (el) =>
    el
      ? {
          transform: window.getComputedStyle(el).transform,
          filter: window.getComputedStyle(el).filter,
          opacity: window.getComputedStyle(el).opacity,
        }
      : null;
  return {
    signature: read(sigMotion),
    firstRow: read(rowMotion),
  };
});

console.log("MID-ANIMATION SAMPLES:");
for (const s of samples) {
  console.log(`  t=${s.atMs}ms`);
  console.log("    signature:", JSON.stringify(s.signature));
  console.log("    firstRow: ", JSON.stringify(s.firstRow));
}
console.log("\nSETTLED:");
console.log("  signature:", JSON.stringify(settled.signature));
console.log("  firstRow: ", JSON.stringify(settled.firstRow));

const failures = [];

// Find the earliest sample where the entrance was actually mid-flight
// (blur > 0 OR scale < 1 OR opacity < 1) — IO-triggered entrance may
// start a few ms after scrollTo lands.
const sigActive = samples.find((s) => {
  if (!s.signature) return false;
  const m = parseMatrix(s.signature.transform);
  const blur = parseBlurPx(s.signature.filter);
  return blur > 0.1 || m.sx < 0.99 || Number.parseFloat(s.signature.opacity) < 0.99;
});
const rowActive = samples.find((s) => {
  if (!s.firstRow) return false;
  const m = parseMatrix(s.firstRow.transform);
  const blur = parseBlurPx(s.firstRow.filter);
  return blur > 0.1 || m.ty > 0.5 || Number.parseFloat(s.firstRow.opacity) < 0.99;
});

if (!sigActive) {
  failures.push(
    "signature game: never observed in mid-entrance state across samples — either the entrance fired before t=80ms or didn't fire at all"
  );
} else {
  const m = parseMatrix(sigActive.signature.transform);
  const blur = parseBlurPx(sigActive.signature.filter);
  console.log(`\nSignature mid-state @${sigActive.atMs}ms:`);
  console.log(
    `  sx=${m.sx.toFixed(3)} sy=${m.sy.toFixed(3)} tx=${m.tx.toFixed(1)} ty=${m.ty.toFixed(1)} blur=${blur.toFixed(1)}px opacity=${sigActive.signature.opacity}`
  );
  // R-12.4 expectations: scale entrance + blur + rise, NO slideX.
  if (Math.abs(m.tx) > 5) {
    failures.push(
      `signature game has translateX=${m.tx.toFixed(1)}, expected ~0 (slideX was retired in R-12.4)`
    );
  }
  if (blur < 0.5) {
    failures.push(
      `signature game has blur=${blur.toFixed(2)}px, expected >0 (R-12.4 added blur=4 entrance)`
    );
  }
  if (m.sx > 0.99) {
    failures.push(
      `signature game has scale=${m.sx.toFixed(3)}, expected <1 (R-12.4 added scale=0.9 entrance)`
    );
  }
}

if (!rowActive) {
  failures.push("first recent row: never observed in mid-entrance state across samples");
} else {
  const m = parseMatrix(rowActive.firstRow.transform);
  const blur = parseBlurPx(rowActive.firstRow.filter);
  console.log(`\nFirst row mid-state @${rowActive.atMs}ms:`);
  console.log(
    `  sx=${m.sx.toFixed(3)} sy=${m.sy.toFixed(3)} tx=${m.tx.toFixed(1)} ty=${m.ty.toFixed(1)} blur=${blur.toFixed(1)}px opacity=${rowActive.firstRow.opacity}`
  );
  // R-12.4 expectations for rows: blur dissolve + small rise, NO slideX=18.
  if (Math.abs(m.tx) > 5) {
    failures.push(
      `recent row has translateX=${m.tx.toFixed(1)}, expected ~0 (slideX=18 retired in R-12.4)`
    );
  }
  if (blur < 0.3) {
    failures.push(
      `recent row has blur=${blur.toFixed(2)}px, expected >0 (R-12.4 added blur=3 entrance)`
    );
  }
}

// Settled checks — entrance should resolve to identity transform + no
// blur + opacity 1 within the wait window.
if (settled.signature) {
  const m = parseMatrix(settled.signature.transform);
  const blur = parseBlurPx(settled.signature.filter);
  if (Math.abs(m.tx) > 1 || Math.abs(m.ty) > 1 || Math.abs(m.sx - 1) > 0.01) {
    failures.push(
      `signature game did not settle to identity transform: sx=${m.sx} tx=${m.tx} ty=${m.ty}`
    );
  }
  if (blur > 0.1)
    failures.push(`signature game did not clear blur: ${blur.toFixed(2)}px`);
  if (Number.parseFloat(settled.signature.opacity) < 0.99)
    failures.push(
      `signature game did not settle to opacity 1: ${settled.signature.opacity}`
    );
}

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(" -", f);
  process.exitCode = 1;
} else {
  console.log("\nALL CHECKS PASSED");
}

await browser.close();
