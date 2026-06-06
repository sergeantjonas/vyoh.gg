// Probe: verify the multi-beat chapter respects prefers-reduced-motion
// across every browser engine (Chromium, WebKit, Firefox). Per ADR-4
// and the R-11 mandate ("verify on real WebKit"), the multi-beat
// chapter must collapse to a vertical stack of beats on every engine
// when `prefers-reduced-motion: reduce` is set.
//
// Expected behavior under reduced motion (per engine):
// - data-reduced-motion attribute present on the chapter section
// - Sticky stage NOT rendered
// - Horizontal track NOT rendered
// - Editorial chrome (beat indicator) NOT rendered
// - Slash + parallax primitives still render but at static end-state
//   (transform=none, no scroll-coupled motion)
// - All beat content visible in document order (no display:none on beats)
// WebKit's headless binary needs system libs (libgstreamer, libgtk-4,
// libgraphene, etc.) that aren't in this devcontainer. Probe covers
// Chromium + Firefox here; WebKit verification falls to owner-side
// review on real Safari, same pattern as safari-vt-snapshot-cost.md.
import { chromium, firefox } from "playwright";

let exitCode = 0;
for (const browserType of [chromium, firefox]) {
  const browser = await browserType.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:2009/", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-chapter-multi-beat]");

  const audit = await page.evaluate(() => {
    // Structural check: assert the FIRST multi-beat chapter on the page
    // has collapsed to a vertical stack of beats.
    const chapter = document.querySelector("[data-chapter-multi-beat]");
    const hasReducedMotionAttr = chapter?.hasAttribute("data-reduced-motion");
    const stage = chapter?.querySelector("[data-chapter-stage]");
    const track = chapter?.querySelector("[data-chapter-track]");
    const chrome = chapter?.querySelector("[data-editorial-chrome]");
    const slash = chapter?.querySelector("[data-beat-accent-slash]");
    const slashStyle = slash ? window.getComputedStyle(slash) : null;

    // Content check: walk EVERY chapter on the page and assert each beat
    // renders content. The static-stack contract is no good if beats
    // appear empty (e.g. a `nudged`-gated entrance never fires under
    // reduced motion).
    const chapters = [...document.querySelectorAll("[data-recap-chapter]")];
    const emptyBeats = [];
    const hiddenBeats = [];
    for (const c of chapters) {
      const slug = c.getAttribute("data-recap-chapter");
      const beats = [...c.querySelectorAll("[data-beat]")];
      for (const [i, b] of beats.entries()) {
        const cs = window.getComputedStyle(b);
        if (cs.display === "none") hiddenBeats.push(`${slug}#${i}`);
        const text = b.textContent?.trim() ?? "";
        if (text.length === 0) emptyBeats.push(`${slug}#${i}`);
      }
    }

    return {
      hasReducedMotionAttr,
      stagePresent: !!stage,
      trackPresent: !!track,
      chromePresent: !!chrome,
      slashPresent: !!slash,
      slashTransform: slashStyle?.transform ?? null,
      chapterCount: chapters.length,
      emptyBeats,
      hiddenBeats,
    };
  });

  const name = browserType.name();
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(audit, null, 2));

  const failures = [];
  if (!audit.hasReducedMotionAttr)
    failures.push("expected data-reduced-motion attribute");
  if (audit.stagePresent) failures.push("sticky stage should NOT render");
  if (audit.trackPresent) failures.push("horizontal track should NOT render");
  if (audit.chromePresent) failures.push("editorial chrome should NOT render");
  if (!audit.slashPresent) failures.push("slash should still render at static end-state");
  if (audit.slashTransform && audit.slashTransform !== "none")
    failures.push(`slash should have transform=none, got ${audit.slashTransform}`);
  if (audit.hiddenBeats.length > 0)
    failures.push(
      `beats display:none under reduced motion: ${audit.hiddenBeats.join(", ")}`
    );
  if (audit.emptyBeats.length > 0)
    failures.push(
      `beats render empty under reduced motion: ${audit.emptyBeats.join(", ")}`
    );

  if (failures.length > 0) {
    console.error(`✗ FAILURES on ${name}:`);
    for (const f of failures) console.error(`  - ${f}`);
    exitCode = 1;
  } else {
    console.log(`✓ ${name} PASSED`);
  }
  await browser.close();
}
process.exitCode = exitCode;
