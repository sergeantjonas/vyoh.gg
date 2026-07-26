// Profile icons route through the project image proxy
// (`/img/lol/profile-icon/:iconId/:patch.webp`) which fetches from DDragon
// upstream. Wiki hosts a `Module:Profile-Icons/V1` shell but the actual image
// set isn't populated, so wiki-sourcing isn't yet viable.
//
// Public base, mirroring the rest of `champion-icon.ts` — this string is
// rendered into an <img src>, so it must not vary between the server and the
// browser the way the fetch origin does.
import { API_PUBLIC_URL } from "@/lib/api-url";

export function profileIconUrl(iconId: number, patch: string): string {
  return `${API_PUBLIC_URL}/img/lol/profile-icon/${iconId}/${patch}.webp`;
}
