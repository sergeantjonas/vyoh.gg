const CDRAGON_CDN = "https://cdn.communitydragon.org/latest";

export function profileIconUrl(iconId: number): string {
  return `${CDRAGON_CDN}/profile-icon/${iconId}`;
}
