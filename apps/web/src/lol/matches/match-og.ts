// Single source for the per-match OG image URL, shared by the match-detail
// layout head() and the subtab heads (recap / your-game / review / timeline —
// the subtabs are the shareable URLs since the index route redirects, so each
// must emit the og:image itself rather than inherit a mismatched twitter:card).
// The hardcoded localhost base is the known hosting-gated fix (item O in
// frontend-2026-gaps.md); it lands as part of the hosting pre-deploy sweep.
const API_URL = "http://localhost:2010";

export function matchOgImage(accountSlug: string, matchId: string): string {
  return `${API_URL}/og/match/${accountSlug}/${matchId}.png`;
}
