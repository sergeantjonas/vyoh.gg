// Chunk-1 validation probe for the proposed persistent-frame architecture.
//
// Strategy: inject a synthetic test fixture as a child of <main> shaped like
// the proposed pattern (one outer section ~4× viewport tall, containing a
// sticky `persistent-frame` div and four normal-flow `beat-zone` sections).
// Scroll through it and capture, at each scroll position:
//   - the frame's getBoundingClientRect().top (should stay near 0 while the
//     section is in view, then unstick as the section's bottom passes the
//     viewport top)
//   - the active beat-zone (the one whose content is in the middle of the
//     viewport)
//   - any view-timeline-driven opacity on beat-zone content
//
// Tells us, before we touch production code, whether long-sticky inside the
// existing <main> scroll container behaves the way we need it to for chapters
// of 3–5 viewport-heights' worth of content.
//
// Run a dev server on :2009 first, then: node scripts/diagnose-persistent-frame.mjs
// Optional env: URL=http://localhost:2009/ ENGINES=chromium,firefox,webkit

import { chromium, firefox, webkit } from "playwright";

const URL_TARGET = process.env.URL || "http://localhost:2009/";
const ENGINES = (process.env.ENGINES || "chromium").split(",");
const VIEWPORT = { width: 1280, height: 720 };

const ENGINE_LAUNCHERS = { chromium, firefox, webkit };

const FIXTURE_HTML = `
  <section id="probe-fixture" style="
    position: relative;
    width: 100%;
    background: #111;
    color: white;
  ">
    <div id="probe-frame" style="
      position: sticky;
      top: 0;
      height: 100dvh;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(80, 0, 120, 0.3);
      font-size: 48px;
      z-index: 1;
    ">
      <span>FRAME (should stay pinned)</span>
    </div>
    <div class="probe-beat" data-beat-zone="0" style="
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: -100dvh;
      position: relative;
      z-index: 2;
      background: rgba(0, 100, 200, 0.15);
    ">BEAT 0</div>
    <div class="probe-beat" data-beat-zone="1" style="
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
      background: rgba(0, 200, 100, 0.15);
    ">BEAT 1</div>
    <div class="probe-beat" data-beat-zone="2" style="
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
      background: rgba(200, 100, 0, 0.15);
    ">BEAT 2</div>
    <div class="probe-beat" data-beat-zone="3" style="
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
      background: rgba(200, 0, 100, 0.15);
    ">BEAT 3</div>
  </section>
`;

const FIXTURE_INSTALL = `
  (function installFixture() {
    const main = document.querySelector("main");
    if (!main) return { installed: false, reason: "no <main> found" };

    // Remove app content during the probe so we measure raw sticky behavior
    // inside the same scroll container, not in competition with hundreds of
    // existing nodes whose stacking + transforms could affect sticky.
    const previousChildren = Array.from(main.children);
    main.dataset.probeOriginalChildCount = String(previousChildren.length);
    for (const child of previousChildren) child.remove();

    main.insertAdjacentHTML("beforeend", ${JSON.stringify(FIXTURE_HTML)});

    // Restore on cleanup via a sentinel — actual cleanup runs from Node side
    // by reload(), simpler than serialising the old subtree.
    return {
      installed: true,
      mainScrollHeight: main.scrollHeight,
      mainClientHeight: main.clientHeight,
      mainScrollPosition: getComputedStyle(main).position,
      mainScrollSnap: getComputedStyle(main).scrollSnapType,
      fixtureHeight: document.getElementById("probe-fixture")?.scrollHeight,
    };
  })();
`;

const SAMPLE_FN = `
  (function sampleAt() {
    const main = document.querySelector("main");
    const fixture = document.getElementById("probe-fixture");
    const frame = document.getElementById("probe-frame");
    if (!main || !fixture || !frame) return null;

    const fixtureRect = fixture.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const beats = Array.from(document.querySelectorAll(".probe-beat")).map((el) => {
      const r = el.getBoundingClientRect();
      return { idx: Number(el.dataset.beatZone), top: r.top, bottom: r.bottom };
    });

    // Which beat is dominant (its midpoint nearest viewport center)?
    const vh = main.clientHeight;
    const vCenter = vh / 2;
    let dominantIdx = -1;
    let dominantDist = Infinity;
    for (const b of beats) {
      const mid = (b.top + b.bottom) / 2;
      const d = Math.abs(mid - vCenter);
      if (d < dominantDist) {
        dominantDist = d;
        dominantIdx = b.idx;
      }
    }

    return {
      scrollTop: main.scrollTop,
      fixture: { top: fixtureRect.top, bottom: fixtureRect.bottom },
      frame: {
        top: frameRect.top,
        bottom: frameRect.bottom,
        height: frameRect.height,
        position: getComputedStyle(frame).position,
      },
      dominantBeat: dominantIdx,
      beatsCount: beats.length,
    };
  })();
`;

function fmt(n) {
  return n == null ? "—" : Math.round(n * 10) / 10;
}

async function runEngine(engineName) {
  const launcher = ENGINE_LAUNCHERS[engineName];
  if (!launcher) {
    console.log(`! unknown engine: ${engineName}`);
    return;
  }
  console.log(`\n========== ${engineName.toUpperCase()} ==========`);

  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (err) {
    console.log(`! launch failed: ${err.message}`);
    return;
  }

  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [browser error] ${msg.text()}`);
  });

  console.log(`loading ${URL_TARGET}…`);
  try {
    await page.goto(URL_TARGET, { waitUntil: "networkidle", timeout: 15_000 });
  } catch (err) {
    console.log(`! page load failed: ${err.message}`);
    await browser.close();
    return;
  }
  await page.waitForSelector("main", { timeout: 5_000 });

  // Capture engine support flags
  const engineFlags = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    hasViewTimeline: "ViewTimeline" in window,
    supportsScrollTimeline: CSS.supports("animation-timeline", "scroll()"),
    supportsViewTimeline: CSS.supports("animation-timeline", "view()"),
  }));
  console.log("engine flags:", JSON.stringify(engineFlags));

  const installResult = await page.evaluate(FIXTURE_INSTALL);
  console.log("fixture install:", JSON.stringify(installResult));
  if (!installResult?.installed) {
    await browser.close();
    return;
  }

  // Probe at increments of 0.25× viewport height through the fixture.
  // Fixture is ~4×viewport tall, so 20 samples (0 → 5×) covers entry,
  // pin window, and exit comfortably.
  console.log(
    "\nSAMPLES (scrollTop, fixture.top, fixture.bottom, frame.position, frame.top, frame.bottom, dominantBeat)"
  );
  console.log("  scroll  fix.top  fix.bot  pos     fr.top  fr.bot  dom");
  console.log("  ------  -------  -------  ------  ------  ------  ---");
  const samples = 25;
  const step = (VIEWPORT.height * 5) / samples;
  for (let i = 0; i <= samples; i++) {
    const targetScroll = Math.round(i * step);
    await page.evaluate((y) => {
      document.querySelector("main")?.scrollTo({ top: y, behavior: "instant" });
    }, targetScroll);
    await page.waitForTimeout(60);
    const s = await page.evaluate(SAMPLE_FN);
    if (!s) {
      console.log(`  (no sample at scroll=${targetScroll})`);
      continue;
    }
    console.log(
      `  ${String(s.scrollTop).padStart(6)}  ${String(fmt(s.fixture.top)).padStart(7)}  ${String(fmt(s.fixture.bottom)).padStart(7)}  ${s.frame.position.padEnd(6)}  ${String(fmt(s.frame.top)).padStart(6)}  ${String(fmt(s.frame.bottom)).padStart(6)}  ${s.dominantBeat}`
    );
  }

  // Verdict heuristics
  console.log(`\nVERDICT for ${engineName}:`);
  await page.evaluate(() => {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(60);

  const verdict = await page.evaluate(() => {
    const main = document.querySelector("main");
    const fixture = document.getElementById("probe-fixture");
    const frame = document.getElementById("probe-frame");
    if (!main || !fixture || !frame) return { ok: false, reason: "fixture gone" };

    const samples = [];
    // Sample at 10 scroll points through the fixture's middle (pin window).
    const fixtureTop = fixture.offsetTop;
    const fixtureHeight = fixture.scrollHeight;
    const startScroll = fixtureTop;
    const endScroll = fixtureTop + fixtureHeight - main.clientHeight;
    for (let i = 0; i <= 10; i++) {
      const y = startScroll + ((endScroll - startScroll) * i) / 10;
      main.scrollTo({ top: y, behavior: "instant" });
      // synchronous read
      const r = frame.getBoundingClientRect();
      samples.push({ y, frameTop: r.top });
    }
    // Frame should remain near 0 throughout the pin window.
    const maxDrift = Math.max(...samples.map((s) => Math.abs(s.frameTop)));
    return {
      ok: maxDrift < 5,
      maxDrift,
      samples: samples.map((s) => ({ y: Math.round(s.y), top: Math.round(s.frameTop) })),
    };
  });
  console.log(
    `  pin window drift: ${verdict.maxDrift?.toFixed(1) ?? "?"}px ${verdict.ok ? "OK ✓" : "PROBLEM ✗"}`
  );
  if (!verdict.ok) {
    console.log("  samples:", JSON.stringify(verdict.samples));
  }

  await browser.close();
}

for (const engine of ENGINES) {
  await runEngine(engine.trim());
}
