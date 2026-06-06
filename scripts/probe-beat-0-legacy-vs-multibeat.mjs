// Probe: directly compare the prose-top position between the legacy
// path (no ?layout=multi-beat) and the multi-beat path, to settle
// whether the current chunk-3 state has actually moved content lower
// than the pre-chunk-3 baseline.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function probe(url, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  // Find Steam chapter in either layout.
  await page.waitForSelector("[data-recap-chapter='steam']");
  await page.evaluate(() => {
    const chapter = document.querySelector("[data-recap-chapter='steam']");
    if (!chapter) return;
    const main = document.querySelector("main");
    if (!main) return;
    const top = chapter.getBoundingClientRect().top + main.scrollTop;
    main.scrollTo({ top, behavior: "instant" });
  });
  await page.waitForTimeout(600);
  const geom = await page.evaluate(() => {
    const chapter = document.querySelector("[data-recap-chapter='steam']");
    const masthead = chapter?.querySelector("[data-chapter-masthead]");
    // The opener band carries the prose.
    const opener = chapter?.querySelector("[data-band='opener']");
    const prose = opener?.querySelector("p");
    const chapterRect = chapter?.getBoundingClientRect();
    const mastheadRect = masthead?.getBoundingClientRect();
    const proseRect = prose?.getBoundingClientRect();
    return {
      chapterTop: chapterRect?.top,
      mastheadBottom: mastheadRect?.bottom,
      mastheadHeight: mastheadRect?.height,
      proseTop: proseRect?.top,
      proseTopRelativeToChapter:
        proseRect && chapterRect ? proseRect.top - chapterRect.top : null,
    };
  });
  console.log(`${label}: ${JSON.stringify(geom, null, 2)}`);
  return geom;
}

const legacy = await probe("http://localhost:2009/", "LEGACY (ChapterGroup)");
const multi = await probe("http://localhost:2009/?layout=multi-beat", "MULTI-BEAT");

if (
  legacy.proseTopRelativeToChapter !== null &&
  multi.proseTopRelativeToChapter !== null
) {
  const delta = multi.proseTopRelativeToChapter - legacy.proseTopRelativeToChapter;
  console.log(
    `\nMulti-beat prose is ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}px ${delta >= 0 ? "LOWER" : "HIGHER"} than legacy.`
  );
}

await browser.close();
