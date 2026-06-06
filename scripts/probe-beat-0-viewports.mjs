// Probe: measure prose-top vs masthead-bottom across common viewport
// sizes. Logo max-h is `dvh`-relative so masthead grows on larger
// screens; need to know if prose is dropping low because of that
// stretch or because of something else in the layout.
import { chromium } from "playwright";

const VIEWPORTS = [
  { name: "Macbook 14 (1512)", width: 1512, height: 982 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1728x1117 (16in)", width: 1728, height: 1117 },
  { name: "1920x1080 (FHD)", width: 1920, height: 1080 },
  { name: "2560x1440 (QHD)", width: 2560, height: 1440 },
];

const browser = await chromium.launch({ headless: true });

for (const v of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
  });
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
    const mastheadRect = masthead?.getBoundingClientRect();
    const proseRect = prose?.getBoundingClientRect();
    return {
      mastheadBottom: mastheadRect?.bottom,
      mastheadHeight: mastheadRect?.height,
      proseTop: proseRect?.top,
      gapMastheadToProse:
        proseRect && mastheadRect ? proseRect.top - mastheadRect.bottom : null,
    };
  });

  console.log(
    `${v.name} (${v.width}x${v.height}): masthead.bottom=${geom.mastheadBottom?.toFixed(0)}, prose.top=${geom.proseTop?.toFixed(0)}, gap=${geom.gapMastheadToProse?.toFixed(0)}, masthead.height=${geom.mastheadHeight?.toFixed(0)}`
  );

  await ctx.close();
}

await browser.close();
