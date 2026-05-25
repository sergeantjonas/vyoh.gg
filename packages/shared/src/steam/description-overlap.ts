// Strip sentences from the full description that are already literally
// present in the short description.
//
// Context: Steam's `short_description` is editorial-supplied marketing
// copy. Publishers often copy-paste one or two opening sentences from the
// full description verbatim, then add more depth below. When the owner
// expands the full body on the game-detail card, those copy-pasted
// sentences repeat the always-visible summary above. The earlier
// implementation tried a word-overlap heuristic with a tunable threshold,
// but tunable thresholds are guesses — either too aggressive (strips
// paraphrased lines with unique storytelling detail) or too conservative
// (leaves clear duplicates). The simpler, predictable rule is:
//
//   For each sentence in the short, build a flexible-whitespace regex
//   that case-insensitively matches the sentence's exact token sequence,
//   and delete every occurrence from the full body. Sentences that aren't
//   literally present (paraphrased openings, unique storytelling) stay
//   untouched.
//
// The Resident Evil 4 case:
//   - Short sentences:
//       "Survival is just the beginning."
//       "Six years have passed since the biological disaster in Raccoon City."
//       "Leon S. Kennedy, one of the survivors, tracks the president's
//        kidnapped daughter to a secluded European village, where there
//        is something terribly wrong with the locals."
//   - First two appear verbatim in the full → stripped.
//   - Third doesn't appear verbatim — the full says "Agent Leon S.
//     Kennedy, one of the survivors of the incident, has been sent to
//     rescue…" → left intact.
//
// Tagline-style shorts (no copy-pasted sentences in the full) no-op:
// none of the sentence regexes match, so the full body is returned
// unchanged.

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

// Minimum sentence length to attempt removal — short fragments like "Yes."
// or "Run." would match spuriously inside larger sentences and corrupt the
// body. 12 chars is below "Survival is just the beginning." (32) but above
// any single-word exclamation.
const MIN_SENTENCE_CHARS = 12;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SENTENCE_CHARS);
}

// Build a case-insensitive global regex that matches the sentence's token
// sequence with flexible whitespace between tokens — covers the common
// case where the full body breaks a sentence across newlines or extra
// spaces that the short description doesn't have.
function buildSentenceRegex(sentence: string): RegExp | null {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const pattern = tokens.map(escapeRegex).join("\\s+");
  return new RegExp(pattern, "gi");
}

export function stripLeadingOverlapWithShort(
  bbcode: string,
  shortDescription: string | null | undefined
): string {
  if (!shortDescription?.trim()) return bbcode;
  const sentences = splitSentences(shortDescription);
  if (sentences.length === 0) return bbcode;

  let result = bbcode;
  for (const sentence of sentences) {
    const re = buildSentenceRegex(sentence);
    if (!re) continue;
    result = result.replace(re, "");
  }
  // Collapse the blank lines a deletion may have left behind (`\n\n\n` →
  // `\n\n`) and trim leading whitespace so the body opens cleanly on the
  // first surviving paragraph.
  return result.replace(/\n{3,}/g, "\n\n").trimStart();
}
