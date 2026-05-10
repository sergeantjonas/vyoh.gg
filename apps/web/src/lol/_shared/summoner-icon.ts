// w=72 covers 2× retina for the largest display size (size-9 = 36 CSS px).
export function profileIconUrl(iconId: number, width = 72): string {
  return `https://wsrv.nl/?url=cdn.communitydragon.org/latest/profile-icon/${iconId}&w=${width}&output=webp&q=85`;
}

export function profileIconFallbackUrl(iconId: number, version: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
}
