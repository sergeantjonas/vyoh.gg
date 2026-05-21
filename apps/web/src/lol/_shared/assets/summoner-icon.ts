// Profile icons route through the project image proxy
// (`/img/lol/profile-icon/:iconId/:patch.webp`) which fetches from DDragon
// upstream. Wiki hosts a `Module:Profile-Icons/V1` shell but the actual image
// set isn't populated, so wiki-sourcing isn't yet viable.
//
// Absolute base URL mirrors the rest of `champion-icon.ts` — same-origin in
// production via Nginx, direct hit against the Nest port in dev.
const API_URL = "http://localhost:2010";

export function profileIconUrl(iconId: number, patch: string): string {
  return `${API_URL}/img/lol/profile-icon/${iconId}/${patch}.webp`;
}
