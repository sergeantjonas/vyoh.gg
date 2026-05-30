// Shared Motion `layoutId` keys for the Steam identity scroll-collapse morph
// (M2 of the nav-condensation arc — the Steam parallel of the LoL identity
// morph in apps/web/src/lol/profile/identity-layout.ts). The avatar + persona
// name travel between two mount points as the page scrolls:
//   - the cinematic hero on the Steam Profile landing (steam-identity-hero.tsx,
//     inside <main>), and
//   - the compact section strip (SteamIdentity in routes/steam.tsx, portaled
//     into the fixed header band).
// Exactly one element may own each id at a time — see the single-mount logic
// in both call sites, gated on `compact` (scroll state) + `isProfileIndex`.
// The ids are namespaced (`steam-*`) so a future cross-section morph never
// collides with the LoL keys (`lol-*`) in the DOM at the same instant.
export const STEAM_IDENTITY_AVATAR_MORPH_ID = "steam-identity-avatar";
export const STEAM_IDENTITY_NAME_MORPH_ID = "steam-identity-name";
