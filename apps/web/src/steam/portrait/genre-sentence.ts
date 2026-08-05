// Locale pinned rather than left ambient: this string renders on the server and
// again at hydration, and a container that resolves a different default locale
// would join the same list two different ways — the container-divergence trap
// in docs/repo-conventions.md, with `Intl` in place of a date formatter.
const CONJUNCTION = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/** `["a", "b", "c"]` → `"a, b and c"`. */
export function genreSentence(genres: readonly string[]): string {
  return CONJUNCTION.format(genres);
}
