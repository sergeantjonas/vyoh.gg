// Probe whether the count-up animation on the Steam chapter "stats" band
// (peak chips: Completion / Two weeks / Rarest unlock) causes layout
// repositioning while the numbers tween up.
//
// The PeakChip primitive in apps/web/src/home/recap/steam-chapter.tsx
// wraps the count-up value `<span>` in a fixed `min-width: Nch` +
// `text-align: right` box, sized to the FINAL digit count, so the suffix
// (`%` / `h`) shouldn't get pushed around as digits grow. This probe
// verifies that empirically by sampling getBoundingClientRect at several
// points during the count-up window.
//
// Run a dev server on :2009 first, then:
//   node scripts/probe-countup-shift.mjs
//
// Idempotent — re-runnable; doesn't write any state.
//
// Approach:
//   1. Navigate to / with ?layout=multi-beat
//   2. Scroll vertically to bring the stats beat (beat 2, data-band='stats')
//      into the active position (~50% through the chapter's scroll runway
//      for a 4-beat chapter: beat 2 is at progress 2/3 ≈ 0.66 along the
//      horizontal track-x mapping, but useInView fires on intersection so
//      we sample several scroll positions and pick the one where the stats
//      band is in view).
//   3. As soon as beat-2 enters view, the reveal cascade fires and the
//      count-up starts after ~delay+0.7s. We then sample rects at fixed
//      wall-clock offsets relative to that activation.

import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:2009/?layout=multi-beat";
const VIEWPORT = { width: 1920, height: 1200 };
// Sampling cadence relative to count-up START. ChapterReveal entrances run
// scale=0.86 + rise=24 + duration=0.7s with per-chip delays of {0.08,
// 0.22, 0.36}s, so reveals finish around ~780/920/1060ms after activation.
// CountUp itself uses delay + 0.7s offset and runs 0.7s, so count-ups run
// roughly 780–1760ms after activation — overlapping the tail of the
// reveal. To isolate count-up-induced shift from reveal-induced motion,
// we wait until ALL reveals have settled (~1100ms after activation) and
// then sample across the count-up window.
//
// WARM_MS = wait after detecting the stats band is in view before we
// snapshot the baseline (lets reveal transforms settle).
const WARM_MS = 1100;
const SAMPLE_OFFSETS_MS = [0, 100, 200, 300, 400, 500, 600, 800];
// Anything bigger than this between two samples on the same element is
// flagged as a real layout shift.
const SHIFT_THRESHOLD_PX = 2;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 20_000 });
await page.waitForSelector("[data-chapter-multi-beat]", { timeout: 10_000 });

// Resolve first-chapter scroll bounds so we can drive vertical scroll to
// the position that brings the stats beat into the active viewport.
const bounds = await page.evaluate(() => {
  const main = document.querySelector("main");
  const chapter = document.querySelector("[data-chapter-multi-beat]");
  if (!chapter || !main) return null;
  const sectionTopInMain =
    chapter.getBoundingClientRect().top +
    main.scrollTop -
    main.getBoundingClientRect().top;
  const sectionHeight = chapter.getBoundingClientRect().height;
  return {
    sectionTopInMain,
    sectionHeight,
    mainClientHeight: main.clientHeight,
    progressOneScroll: sectionTopInMain + sectionHeight - main.clientHeight,
  };
});

if (!bounds) {
  console.log("✗ could not resolve chapter bounds");
  await browser.close();
  process.exit(1);
}

// Beat 2 in a 4-beat chapter sits in the active viewport roughly between
// progress ~0.55 and ~0.75 of the chapter scroll runway (DWELL+TRANSITION
// piecewise mapping). We scroll to ~0.62 and verify the stats band is
// actually in view before sampling.
async function scrollToStatsBeat() {
  const target =
    bounds.sectionTopInMain + 0.62 * (bounds.progressOneScroll - bounds.sectionTopInMain);
  await page.evaluate((s) => {
    document.querySelector("main").scrollTo({ top: s, behavior: "instant" });
  }, target);
}

// Find the stats band + its three direct chip children. Returns a stable
// shape for rect sampling.
async function detectStatsLayout() {
  return await page.evaluate(() => {
    const band = document.querySelector("[data-chapter-multi-beat] [data-band='stats']");
    if (!band) return { found: false };
    // Each PeakChip is wrapped by a ChapterReveal which renders a
    // motion.div. So the band's direct children are the reveal wrappers;
    // inside each is `<div class="flex flex-col gap-2 sm:gap-3">` with
    // value span and label span.
    const chipWrappers = Array.from(band.children);
    const chips = chipWrappers.map((wrap, i) => {
      // Drill to the inner flex-col which holds value + label.
      const inner = wrap.querySelector(":scope > div");
      const valueSpan = inner?.querySelector(":scope > span:nth-child(1)");
      const labelSpan = inner?.querySelector(":scope > span:nth-child(2)");
      // The count-up reservation span sits inside valueSpan as its first
      // child; suffix text follows after it.
      const reservedSpan = valueSpan?.querySelector(":scope > span");
      return {
        idx: i,
        labelText: labelSpan?.textContent?.trim() || null,
        valueText: valueSpan?.textContent?.trim() || null,
        reservedText: reservedSpan?.textContent?.trim() || null,
      };
    });
    return {
      found: true,
      bandRect: band.getBoundingClientRect().toJSON(),
      chips,
    };
  });
}

function snapshotRects() {
  return page.evaluate(() => {
    const band = document.querySelector("[data-chapter-multi-beat] [data-band='stats']");
    if (!band) return null;
    const chips = Array.from(band.children).map((wrap) => {
      const inner = wrap.querySelector(":scope > div");
      const valueSpan = inner?.querySelector(":scope > span:nth-child(1)");
      const labelSpan = inner?.querySelector(":scope > span:nth-child(2)");
      const reservedSpan = valueSpan?.querySelector(":scope > span");
      return {
        wrapRect: wrap.getBoundingClientRect().toJSON(),
        valueRect: valueSpan?.getBoundingClientRect().toJSON() ?? null,
        labelRect: labelSpan?.getBoundingClientRect().toJSON() ?? null,
        reservedRect: reservedSpan?.getBoundingClientRect().toJSON() ?? null,
        valueText: valueSpan?.textContent?.trim() ?? null,
        reservedText: reservedSpan?.textContent?.trim() ?? null,
      };
    });
    return { bandRect: band.getBoundingClientRect().toJSON(), chips };
  });
}

await scrollToStatsBeat();
// Wait for useInView to fire and the reveal cascade to settle. Without
// this warm-up the baseline rect captures ChapterReveal's in-flight
// transform (scale + translateY) and contaminates the comparison.
await page.waitForTimeout(WARM_MS);

const layout = await detectStatsLayout();
if (!layout.found) {
  console.log("✗ stats band not found at scroll target");
  await browser.close();
  process.exit(1);
}

console.log("=== Stats band detected ===");
console.log(JSON.stringify(layout, null, 2));

// Establish t=0 right after the count-up should begin. The count-up's
// delay is delay + 0.7s where delay ∈ {0.08, 0.22, 0.36}. So the first
// count-up starts at ~780ms after activation, the last at ~1060ms.
// We sample from now (~50ms after activation) every offset; this gives us
// a window that spans the start of the first count-up through the end of
// the last one.
const t0 = Date.now();
const samples = [];
for (const offset of SAMPLE_OFFSETS_MS) {
  const target = t0 + offset;
  const wait = target - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  const snap = await snapshotRects();
  samples.push({ tMs: offset, snap });
}

// Compare samples — for each element, find the max delta (px) across the
// sampling window in x and y for both top-left corner and width.
function delta(a, b) {
  if (!a || !b) return null;
  return {
    dLeft: +(b.left - a.left).toFixed(2),
    dTop: +(b.top - a.top).toFixed(2),
    dWidth: +(b.width - a.width).toFixed(2),
    dHeight: +(b.height - a.height).toFixed(2),
  };
}

function maxAbs(deltas, key) {
  return Math.max(...deltas.map((d) => Math.abs(d[key] ?? 0)));
}

const baseline = samples[0].snap;
const findings = [];
for (let chipIdx = 0; chipIdx < baseline.chips.length; chipIdx += 1) {
  const base = baseline.chips[chipIdx];
  for (const part of ["wrapRect", "valueRect", "reservedRect", "labelRect"]) {
    const baseRect = base[part];
    const deltas = samples.map((s) => ({
      tMs: s.tMs,
      delta: delta(baseRect, s.snap.chips[chipIdx]?.[part]),
    }));
    const validDeltas = deltas.map((d) => d.delta).filter((d) => d !== null);
    const maxLeft = maxAbs(validDeltas, "dLeft");
    const maxTop = maxAbs(validDeltas, "dTop");
    const maxWidth = maxAbs(validDeltas, "dWidth");
    const maxHeight = maxAbs(validDeltas, "dHeight");
    findings.push({
      chip: chipIdx,
      label: base.valueText,
      part,
      maxLeft,
      maxTop,
      maxWidth,
      maxHeight,
      shifted:
        maxLeft > SHIFT_THRESHOLD_PX ||
        maxTop > SHIFT_THRESHOLD_PX ||
        maxWidth > SHIFT_THRESHOLD_PX ||
        maxHeight > SHIFT_THRESHOLD_PX,
    });
  }
}

console.log("\n=== Samples (value text per chip, by time offset) ===");
for (const s of samples) {
  console.log(
    `t=${String(s.tMs).padStart(5)}ms  ${s.snap.chips
      .map((c) => `[${c.valueText}]`)
      .join(" ")}`
  );
}

console.log("\n=== Rect deltas across sampling window ===");
console.log(
  "chip | label-snapshot | part        | dLeft | dTop  | dWidth | dHeight | shifted?"
);
for (const f of findings) {
  console.log(
    `${String(f.chip).padStart(4)} | ${String(f.label ?? "").padEnd(14)} | ${f.part.padEnd(12)} | ${String(f.maxLeft).padStart(5)} | ${String(f.maxTop).padStart(5)} | ${String(f.maxWidth).padStart(6)} | ${String(f.maxHeight).padStart(7)} | ${f.shifted ? "YES" : "no"}`
  );
}

const offenders = findings.filter((f) => f.shifted);
console.log("\n=== Verdict ===");
if (offenders.length === 0) {
  console.log(
    `✓ STABLE — all rects within ${SHIFT_THRESHOLD_PX}px across the count-up window.`
  );
  console.log(
    "  Owner's perceived repositioning is content settling visually, not a real layout shift."
  );
} else {
  console.log(
    `✗ SHIFT DETECTED — ${offenders.length} rect(s) moved more than ${SHIFT_THRESHOLD_PX}px:`
  );
  for (const o of offenders) {
    console.log(
      `  chip ${o.chip} (${o.label}) ${o.part}: dLeft=${o.maxLeft}, dTop=${o.maxTop}, dWidth=${o.maxWidth}, dHeight=${o.maxHeight}`
    );
  }
}

await browser.close();
process.exit(offenders.length === 0 ? 0 : 2);
