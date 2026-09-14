// Steam serves achievement icons from several CDN roots that share one path
// shape, `<root>/<appid>/<sha1>.jpg`, but do not stay in sync: icons added
// to a schema after release can be missing from the older roots for weeks
// (Onimusha: Way of the Sword's two newest icons 404ed on the akamaihd root
// while the community_assets root served them). Ingest stores the canonical
// URL on the first root; the image proxy never trusts a single root and
// instead walks every one in order, so a stored row keeps rendering even if
// the root it was written against goes stale.
const ACHIEVEMENT_ICON_ROOTS = [
  "https://shared.akamai.steamstatic.com/community_assets/images/apps",
  "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps",
  "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps",
] as const;

export function composeAchievementIconUrl(appid: number, filename: string): string {
  return `${ACHIEVEMENT_ICON_ROOTS[0]}/${appid}/${filename}`;
}

// Ordered fetch chain for a stored icon URL. The filename is the identity;
// the host it was stored under is only a hint, so the stored URL is kept in
// the chain (after the known roots) to cover a host this list doesn't know.
export function achievementIconCandidates(appid: number, storedUrl: string): string[] {
  const path = storedUrl.split(/[?#]/, 1)[0] ?? storedUrl;
  const filename = path.slice(path.lastIndexOf("/") + 1);
  if (!filename) return [storedUrl];
  const chain = ACHIEVEMENT_ICON_ROOTS.map((root) => `${root}/${appid}/${filename}`);
  return chain.includes(storedUrl) ? chain : [...chain, storedUrl];
}
