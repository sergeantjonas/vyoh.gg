// Single source for the per-match OG image URL, shared by the match-detail
// layout head() and the subtab heads (recap / your-game / review / timeline —
// the subtabs are the shareable URLs since the index route redirects, so each
// must emit the og:image itself rather than inherit a mismatched twitter:card).
// The public base, not the fetch one: a crawler resolves this from outside the
// box, so it has to be the absolute origin on both sides of a server render.
import { API_PUBLIC_URL } from "@/lib/api-url";

export function matchOgImage(accountSlug: string, matchId: string): string {
  return `${API_PUBLIC_URL}/og/match/${accountSlug}/${matchId}.png`;
}
