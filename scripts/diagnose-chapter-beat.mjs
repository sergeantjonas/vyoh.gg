// One-off diagnostic: scrolls through the recap page in headless Chrome,
// captures computed styles, applied animations, and bounding rects on every
// `[data-beat-inner]` to verify the CSS-timeline path is actually engaging
// the way the code expects. Run while a dev server is up on :2009.
//
// Run: node scripts/diagnose-chapter-beat.mjs

import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:2009/";
const VIEWPORT = { width: 1280, height: 720 };

const fmt = (n) => Math.round(n * 10) / 10;

function snapshot(selector) {
  const nodes = Array.from(document.querySelectorAll(selector));
  return nodes.map((node, idx) => {
    const cs = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const parent = node.parentElement;
    const parentCs = parent ? getComputedStyle(parent) : null;
    const parentRect = parent ? parent.getBoundingClientRect() : null;
    const animations = node.getAnimations
      ? node.getAnimations().map((a) => ({
          name: a.animationName,
          playState: a.playState,
          timeline: a.timeline?.constructor?.name,
          currentTime: a.currentTime,
          effect: a.effect?.getKeyframes
            ? `${a.effect.getKeyframes().length} keyframes`
            : null,
        }))
      : [];
    return {
      idx,
      tag: node.tagName,
      classes: node.className,
      attrs: {
        "data-beat-inner": node.hasAttribute("data-beat-inner"),
        "data-css-timeline": node.hasAttribute("data-css-timeline"),
      },
      computed: {
        position: cs.position,
        top: cs.top,
        opacity: cs.opacity,
        filter: cs.filter,
        transform: cs.transform,
        animationName: cs.animationName,
        animationTimeline: cs.animationTimeline,
        animationRange: cs.animationRange,
        animationFillMode: cs.animationFillMode,
        willChange: cs.willChange,
      },
      rect: { top: rect.top, height: rect.height, y: rect.y },
      animations,
      parent: parent
        ? {
            tag: parent.tagName,
            classes: parent.className,
            attrs: {
              "data-beat": parent.getAttribute("data-beat"),
              "data-beat-wrapper": parent.hasAttribute("data-beat-wrapper"),
            },
            computed: {
              position: parentCs.position,
              height: parentCs.height,
              viewTimelineName: parentCs.viewTimelineName,
              viewTimelineAxis: parentCs.viewTimelineAxis,
              transform: parentCs.transform,
            },
            rect: { top: parentRect.top, height: parentRect.height },
          }
        : null,
    };
  });
}

function getEngineFlags() {
  return {
    hasViewTimeline: "ViewTimeline" in window,
    supportsAnimationTimelineView: CSS.supports("animation-timeline", "view()"),
    supportsAnimationTimelineScroll: CSS.supports("animation-timeline", "scroll()"),
    userAgent: navigator.userAgent,
  };
}

function getScrollState() {
  const main = document.querySelector("main");
  return {
    scrollTop: main?.scrollTop,
    scrollHeight: main?.scrollHeight,
    clientHeight: main?.clientHeight,
    mainPosition: main ? getComputedStyle(main).position : null,
    snapType: main ? getComputedStyle(main).scrollSnapType : null,
  };
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`[browser ${msg.type()}]`, msg.text());
  }
});

console.log(`Loading ${URL}…`);
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("[data-beat-inner], [data-beat]", { timeout: 5000 });

const engineFlags = await page.evaluate(getEngineFlags);
console.log("\n=== ENGINE FLAGS ===");
console.log(JSON.stringify(engineFlags, null, 2));

const scrollState0 = await page.evaluate(getScrollState);
console.log("\n=== SCROLL STATE (at load) ===");
console.log(JSON.stringify(scrollState0, null, 2));

const initialBeats = await page.evaluate(snapshot, "[data-beat-inner]");
console.log("\n=== BEATS AT LOAD (initial render) ===");
console.log(`Found ${initialBeats.length} [data-beat-inner] elements`);
if (initialBeats.length === 0) {
  // Fall back to inspecting raw [data-beat] elements (would hit MotionBeat path)
  const motionBeats = await page.evaluate(snapshot, "[data-beat] > div");
  console.log(`Fallback: ${motionBeats.length} elements matched [data-beat] > div`);
  if (motionBeats.length > 0) {
    console.log("First beat snapshot:", JSON.stringify(motionBeats[0], null, 2));
  }
} else {
  for (const beat of initialBeats.slice(0, 3)) {
    console.log(
      `\n--- Beat #${beat.idx} (data-beat=${beat.parent?.attrs["data-beat"]}) ---`
    );
    console.log(JSON.stringify(beat, null, 2));
  }
}

// Scroll to each beat by index and capture state
const beatCount = await page.evaluate(
  () => document.querySelectorAll("[data-beat]").length
);
console.log(`\n=== SCROLLING THROUGH ${beatCount} BEATS ===`);

for (let i = 0; i < beatCount; i++) {
  const wrapperInfo = await page.evaluate((idx) => {
    const wrapper = document.querySelectorAll("[data-beat]")[idx];
    if (!wrapper) return null;
    wrapper.scrollIntoView({ block: "start", behavior: "instant" });
    return {
      offsetTop: wrapper.offsetTop,
      slug: wrapper.getAttribute("data-beat-slug"),
    };
  }, i);
  if (!wrapperInfo) continue;

  // Let scroll settle
  await page.waitForTimeout(300);

  const state = await page.evaluate((idx) => {
    const main = document.querySelector("main");
    const wrapper = document.querySelectorAll("[data-beat]")[idx];
    const inner =
      wrapper?.querySelector("[data-beat-inner]") || wrapper?.firstElementChild;
    if (!inner) return null;
    const cs = getComputedStyle(inner);
    const wrapRect = wrapper.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const anims = inner.getAnimations
      ? inner.getAnimations().map((a) => ({
          name: a.animationName,
          currentTime: a.currentTime,
          timeline: a.timeline?.constructor?.name,
        }))
      : [];
    return {
      scrollTop: main.scrollTop,
      wrapperRect: { top: wrapRect.top, height: wrapRect.height },
      innerRect: { top: innerRect.top, height: innerRect.height },
      innerComputed: {
        position: cs.position,
        top: cs.top,
        opacity: cs.opacity,
        filter: cs.filter,
        transform: cs.transform,
        animationName: cs.animationName,
      },
      animations: anims,
    };
  }, i);

  console.log(
    `\nBeat[${i}] slug="${wrapperInfo.slug ?? "—"}" offsetTop=${wrapperInfo.offsetTop}`
  );
  console.log(
    `  scroll=${state.scrollTop} wrapper.top=${fmt(state.wrapperRect.top)} inner.top=${fmt(state.innerRect.top)}`
  );
  console.log(
    `  inner.computed: position=${state.innerComputed.position} top=${state.innerComputed.top} opacity=${state.innerComputed.opacity}`
  );
  console.log(
    `  inner.computed: animationName=${state.innerComputed.animationName} filter=${state.innerComputed.filter} transform=${state.innerComputed.transform}`
  );
  if (state.animations.length > 0) {
    console.log(`  WAAPI animations: ${JSON.stringify(state.animations)}`);
  }
}

await browser.close();
