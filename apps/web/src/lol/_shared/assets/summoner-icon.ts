// Profile icons route through the project image proxy
// (`/img/lol/profile-icon/:iconId/:patch.webp`) which fetches from DDragon
// upstream. Wiki hosts a `Module:Profile-Icons/V1` shell but the actual image
// set isn't populated, so wiki-sourcing isn't yet viable.
export function profileIconUrl(iconId: number, patch: string): string {
  return `/img/lol/profile-icon/${iconId}/${patch}.webp`;
}
