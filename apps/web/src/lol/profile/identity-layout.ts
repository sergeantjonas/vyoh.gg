// Shared Motion `layoutId` keys for the LoL identity scroll-collapse morph (M2
// of the nav-condensation arc). The avatar + name travel between two mount
// points as the page scrolls:
//   - the large cinematic hero on the Profile landing (identity-hero.tsx,
//     inside <main>), and
//   - the compact section strip (LolIdentity in routes/lol/$accountSlug.tsx,
//     portaled into the fixed header band).
// Exactly one element may own each id at a time — see the single-mount logic in
// both call sites, gated on `compact` (scroll state) + `isProfileIndex`. The
// constants live here so the two files can't drift apart on the literal.
export const IDENTITY_AVATAR_MORPH_ID = "lol-identity-avatar";
export const IDENTITY_NAME_MORPH_ID = "lol-identity-name";
