// Short→full overlap stripper for Steam game descriptions.
//
// Context: Steam's `short_description` is editorial-supplied marketing copy
// that's often (but NOT always) a condensation of the opening paragraphs of
// `full_description_bbcode`. When the owner expands the full body on the
// game-detail card, repeating those opening lines reads as duplicated text.
// But plenty of games use the short field as a standalone tagline ("A
// roguelike deckbuilder for the cosmically curious"), and stripping content
// in that case would silently delete real information. So this is a
// best-effort heuristic, not a general rule: aggressive enough to catch
// obvious duplication (the Resident Evil 4 case has paraphrased rewrites
// like "Agent Leon" → "Leon"), conservative enough that low-overlap inputs
// are returned unchanged.
//
// Algorithm: walk the BBCode source line-by-line from the top. For each
// leading plain-text line, compute the fraction of its content words (≥3
// chars, not in the stopword list) that also appear in the short
// description's content-word set. Drop the line if that fraction is at or
// above the threshold; continue scanning. STOP at the first line that
// either:
//   - carries a `[` (any BBCode tag — heading, list, code block, etc.).
//     Structured content is publisher-authored editorial and never noise;
//     never touch it.
//   - has overlap below the threshold (we've reached the "new" content the
//     full description adds beyond the short).
// Blank lines are skipped without committing. The remaining body is
// returned verbatim and passed to `bbcodeToHtml` as normal.
//
// Why source-level (not HTML-level): publishers commonly use single
// newlines between sentences within a paragraph, which `bbcodeToHtml`
// joins with `<br>` into one `<p>` block. Per-paragraph HTML comparison
// would treat 4 duplicated sentences + 1 new sentence as one mixed block
// and either drop everything (losing the new one) or nothing. Per-line
// source comparison gets the granularity right — RE4 has 5 leading lines,
// 4 overlap, the 5th doesn't, the stripper keeps the 5th.

// Common English stopwords plus tiny structural words. Filtering these
// stops "the" and "of" appearing in both texts from inflating the overlap
// ratio above noise level.
const STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "but",
  "for",
  "of",
  "with",
  "by",
  "in",
  "on",
  "at",
  "to",
  "from",
  "into",
  "than",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "as",
  "an",
  "a",
  "he",
  "she",
  "him",
  "her",
  "his",
  "hers",
  "they",
  "them",
  "their",
  "who",
  "what",
  "where",
  "when",
  "one",
  "two",
]);

// Threshold tuned against the Resident Evil 4 case + owner sanity check.
// The bar is "near word-for-word duplicate" — sentences that paraphrase
// the short with genuinely new content (e.g. RE4's "Agent Leon S. Kennedy,
// one of the survivors of the incident, has been sent to rescue…" — the
// "Agent" / "incident" / "has been sent to rescue" details aren't in the
// short) should pass through. RE4's paraphrased line scores ~0.55 after
// stopword filtering; setting the threshold at 0.75 keeps it while still
// catching the truly duplicate openers ("Survival is just the beginning.",
// "Six years have passed since the biological disaster in Raccoon City.").
// Earlier 0.5 was too aggressive — it nuked paraphrased content that
// carried unique storytelling detail.
const OVERLAP_THRESHOLD = 0.75;

// Below this, the short description is too thin to be a meaningful corpus
// — a 3-word short would over-trigger on any leading line that happens to
// share one of those words.
const MIN_SHORT_CONTENT_WORDS = 5;

// Skip leading lines below this length too — a single shared content word
// on a 1-word line ("Highlights:") would otherwise score 1.0 and get
// stripped despite being a meaningful header.
const MIN_LINE_CONTENT_WORDS = 3;

function contentWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

function overlapRatio(line: string, shortWords: Set<string>): number {
  const lineWords = contentWords(line);
  if (lineWords.size < MIN_LINE_CONTENT_WORDS) return 0;
  let matches = 0;
  for (const w of lineWords) {
    if (shortWords.has(w)) matches += 1;
  }
  return matches / lineWords.size;
}

export function stripLeadingOverlapWithShort(
  bbcode: string,
  shortDescription: string | null | undefined
): string {
  if (!shortDescription) return bbcode;
  const shortWords = contentWords(shortDescription);
  if (shortWords.size < MIN_SHORT_CONTENT_WORDS) return bbcode;

  const lines = bbcode.split("\n");
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    const trimmed = line?.trim() ?? "";
    if (!trimmed) {
      cursor += 1;
      continue;
    }
    if (trimmed.includes("[")) {
      // Any BBCode tag — never strip editorial structure.
      break;
    }
    if (overlapRatio(trimmed, shortWords) >= OVERLAP_THRESHOLD) {
      cursor += 1;
    } else {
      break;
    }
  }
  // `trimStart` cleans any leading blank lines we stepped over so the
  // remaining body opens cleanly at the first kept paragraph.
  return lines.slice(cursor).join("\n").trimStart();
}
