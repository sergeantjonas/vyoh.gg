import { Link } from "@tanstack/react-router";
import type { SteamPortraitSuggestion } from "@vyoh/shared";

import { genreSentence } from "./genre-sentence";

/**
 * The genres behind a suggestion and what they're worth: `"Souls-like, Action
 * RPG, and Hack and Slash — 55% of your portrait between them"`. Both cards
 * that name a single game show their working, because a recommendation with no
 * visible reason is indistinguishable from a random pick.
 *
 * The percentage is the share of the portrait the matched genres carry, so it
 * is a claim about the owner's hours rather than about the game. `score` can
 * also carry an age penalty, but only where nothing matched at all — and a
 * suggestion with no matches is never rendered — so the number here is the
 * overlap unmodified.
 */
export function describeGenres(suggestion: SteamPortraitSuggestion): string {
  const share = Math.round(suggestion.score * 100);
  return `${genreSentence(suggestion.matched)} — ${share}% of your portrait between them`;
}

/** How much of the game the match covers: the denominator the share hides. */
export function describeCoverage(suggestion: SteamPortraitSuggestion): string {
  const { matched, genreCount } = suggestion;
  return matched.length === genreCount
    ? "Every genre it carries is one you play"
    : `${matched.length} of its ${genreCount} genres are ones you play`;
}

export function OpenGameLink({ appid, name }: { appid: number; name: string }) {
  return (
    <Link
      to="/steam/library/$appid"
      params={{ appid: String(appid) }}
      className="text-foreground/70 text-sm underline-offset-2 hover:underline"
    >
      Open {name} →
    </Link>
  );
}
