// Drift-detection for the rich-description pipeline against canonical wiki
// HTML. Each fixture below was captured verbatim from wiki.leagueoflegends.com
// via the `action=parse` API on 2026-05-21. If wiki changes its template
// rendering, the corresponding inline snapshot diverges and surfaces in PR
// review instead of mangling tooltip text silently at runtime.
//
// Refreshing a fixture: re-render the wikitext from `descriptionWikitext` on
// the bundle (for items) or pull the raw `descriptionHtml` from the bundle
// (for abilities), paste it into the matching constant, and re-run the test
// with `--update` to refresh the snapshot. Read the diff before committing —
// the point is to notice when wiki output shifts.
import { describe, expect, it } from "vitest";
import { toRichDescription } from "./rich-description";

// Ahri Q — "Orb of Deception". Source: bundle `championAbilities["103"]`,
// slot Q. Exercises the most common wiki patterns at once: the
// `template_sbc` Active callout, color-coded damage-type spans
// (`color: #00B0F0` for magic, `#f9966b` for true), and an inline icon
// (`mw:File` span wrapping an `<a>` wrapping an `<img>` thumb-path).
const AHRI_Q_HTML = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><p><span class="template&#95;sbc"><b>Active:</b></span> <b>Ahri</b> sends her orb in the target direction that deals <span style="color: #00B0F0; white-space:normal">magic damage</span> to enemies it passes through. Upon reaching maximum range, it returns to her to deal the same amount in <span style="white-space:nowrap"><span typeof="mw:File"><a href="/en-us/True_damage" title="True damage"><img src="/en-us/images/thumb/Hybrid_penetration_icon.png/15px-Hybrid_penetration_icon.png?385d5" decoding="async" loading="lazy" width="15" height="15" class="mw-file-element" srcset="/en-us/images/thumb/Hybrid_penetration_icon.png/30px-Hybrid_penetration_icon.png?385d5 2x" data-file-width="121" data-file-height="121" /></a></span>&#160;<span style="color: #f9966b; white-space:normal">true damage</span></span> to enemies it passes through.\n</p></div>`;

// Trinity Force passive. Source: wikitext on the bundle item id 3078,
// rendered through the wiki `action=parse` API. Exercises: anchor links
// stripped to text (`<a>ability</a>`, `<a>on-hit</a>`), color-coded stat
// span (`color:orange`), nested `<b>` formatting inside spans, and the
// wiki's `<small>` fractional-digit rendering (`<small>5</small>`) which
// the sanitizer drops to plain text.
const TRINITY_FORCE_HTML = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><p>After using an <a href="/en-us/Champion_ability" title="Champion ability">ability</a>, your next basic attack within 10 seconds deals <span style="color:orange; white-space:normal">200% <b>base</b> AD</span> <span style="color: #FF8C34; white-space:normal"><b>bonus</b> physical damage</span> <a href="/en-us/On-hit" class="mw-redirect" title="On-hit">on-hit</a> (1.<small>5</small> second cooldown, starts after using the empowered attack).\n</p></div>`;

// Hextech Rocketbelt active (formerly Hextech Proto-Belt; wiki renamed).
// Source: wikitext on bundle item id 3152, rendered through wiki
// `action=parse`. Exercises: keyword-tooltip glossary spans with inline
// icons (`tip|Dash`, `tip|cr`), the `basic-tooltip` dotted-underline span
// (stripped to text), and nested `as` color spans (magic damage carrying
// an AP-ratio sub-span).
const HEXTECH_ROCKETBELT_HTML = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><p><span class="glossary" style="white-space:pre; position:relative;" data-game="lol" data-tip="Dash"><span typeof="mw:File"><a href="/en-us/Dash" title="An icon representing the keyword Dash"><img alt="An icon representing the keyword Dash" src="/en-us/images/thumb/Dash.png/20px-Dash.png?e5c61" decoding="async" loading="lazy" width="20" height="20" class="mw-file-element" srcset="/en-us/images/thumb/Dash.png/40px-Dash.png?e5c61 2x" data-file-width="64" data-file-height="64" /></a></span> <a href="/en-us/Dash" title="Dash">Dash</a></span> 275 units in the target direction, though not through terrain, then unleash an arc of 7 rockets forward which travel up to 1050 units; and upon collision with an enemy or terrain, explode in a <span class="glossary" style="white-space:pre; position:relative;" data-game="lol" data-tip="Cr"><span typeof="mw:File"><a href="/en-us/Range" title="An icon representing the keyword Centered range"><img alt="An icon representing the keyword Centered range" src="/en-us/images/thumb/Range_center.png/20px-Range_center.png?cbed4" decoding="async" loading="lazy" width="20" height="20" class="mw-file-element" srcset="/en-us/images/thumb/Range_center.png/40px-Range_center.png?cbed4 2x" data-file-width="480" data-file-height="480" /></a></span></span> <span class="basic-tooltip" style="border-bottom:1px dotted gray;cursor:help;" title="estimated">185-radius</span> area. Enemies within <span class="basic-tooltip" style="border-bottom:1px dotted gray;cursor:help;" title="center-to-edge, estimated">85 units</span> of your dash and ones hit by any rocket's explosion are dealt <span style="color: #00B0F0; white-space:normal">100 <span style="color: #7A6DFF; white-space:normal">(+ 10% AP)</span> magic damage</span>, once per cast.\n</p></div>`;

describe("toRichDescription against canonical wiki HTML", () => {
  it("Ahri Q (Orb of Deception) — ability with damage spans and inline icon", () => {
    expect(toRichDescription(AHRI_Q_HTML)).toMatchInlineSnapshot(`
      "<p><span class="template&amp;#95;sbc"><b>Active:</b></span> <b>Ahri</b> sends her orb in the target direction that deals <span>magic damage</span> to enemies it passes through. Upon reaching maximum range, it returns to her to deal the same amount in <span><span><img src="http://localhost:2010/img/lol/wiki-file/Hybrid_penetration_icon.png.webp" width="15" height="15"></span>&#160;<span>true damage</span></span> to enemies it passes through.
      </p>"
    `);
  });

  it("Trinity Force passive — item with anchor links and stat callouts", () => {
    expect(toRichDescription(TRINITY_FORCE_HTML)).toMatchInlineSnapshot(`
      "<p>After using an ability, your next basic attack within 10 seconds deals <span>200% <b>base</b> AD</span> <span><b>bonus</b> physical damage</span> on-hit (1.5 second cooldown, starts after using the empowered attack).
      </p>"
    `);
  });

  it("Hextech Rocketbelt active — item with keyword glossary icons and nested damage spans", () => {
    expect(toRichDescription(HEXTECH_ROCKETBELT_HTML)).toMatchInlineSnapshot(`
      "<p><span class="glossary"><span><img alt="An icon representing the keyword Dash" src="http://localhost:2010/img/lol/wiki-file/Dash.png.webp" width="20" height="20"></span> Dash</span> 275 units in the target direction, though not through terrain, then unleash an arc of 7 rockets forward which travel up to 1050 units; and upon collision with an enemy or terrain, explode in a <span class="glossary"><span><img alt="An icon representing the keyword Centered range" src="http://localhost:2010/img/lol/wiki-file/Range_center.png.webp" width="20" height="20"></span></span> <span class="basic-tooltip">185-radius</span> area. Enemies within <span class="basic-tooltip">85 units</span> of your dash and ones hit by any rocket's explosion are dealt <span>100 <span>(+ 10% AP)</span> magic damage</span>, once per cast.
      </p>"
    `);
  });
});
