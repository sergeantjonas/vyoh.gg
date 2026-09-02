/**
 * Extract the editorial subtitle from a Steam short description. The full
 * blurb is multiple sentences separated by `\r\n\r\n` paragraphs — we want
 * just the first sentence's worth so a masthead doesn't drown under a
 * marketing paragraph. Falls back to the empty string when nothing parses.
 */
export function firstSentence(short: string | null | undefined): string {
  if (!short) return "";
  // Take everything up to the first paragraph break.
  const para = short.split(/\r?\n\r?\n/)[0] ?? short;
  // Then up to the first sentence terminator. Period is fine; "!" and "?"
  // are rare on Steam taglines but cheap to support.
  const match = para.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? para).trim();
}
