// Steam's Web API does not expose publisher genre, so the Portrait derives it
// from community tags. Those arrive top-20-by-weight per app and mix genres in
// with presentation, mood, setting and market descriptors — run unfiltered
// against the owner's library the top three come out as "Action, Singleplayer,
// Third Person", which characterises nobody. This allowlist is what makes the
// genre cards mean anything.
//
// Inclusion rule: a tag qualifies if it answers *what kind of game is this, or
// what do you do in it*. It does not qualify if it describes how the game looks
// (`2D`, `Isometric`, `Pixel Graphics`), how it feels (`Atmospheric`,
// `Difficult`, `Relaxing`), what it contains (`Violent`, `Nudity`, `Great
// Soundtrack`), where it is set (`Medieval`, `Space`, `Post-apocalyptic`), how
// it is sold (`Indie`, `Free to Play`, `Early Access`), or how it is played
// (`Singleplayer`, `Co-op`, `Controller`, `VR`). Session structure is also out
// — `Multiplayer` and `PvP` are real facts about a game, but they belong to the
// platform-identity card, not the genre fingerprint.
//
// Judgement calls worth knowing, since each could reasonably have gone the
// other way: `Open World` is excluded as a structural property rather than a
// genre (`Open World Survival Craft` is in, because that names a form);
// dimensional prefixes are dropped in favour of their parent, so `Fighting` is
// in and `2D Fighter` is not; `Tactical` and `Base Building` are excluded as
// modifiers that attach to other genres; the activity sims are limited to
// pastimes with their own game tradition (`Farming`, `Fishing`, `Cooking`,
// `Hunting`) rather than every chore a cozy sim has simulated.
//
// Software-category tags (`Utilities`, `Audio Production`, `Benchmark`, …) are
// absent by design — those apps are filtered out by `appType` upstream, so
// allowlisting their tags would only offer a second chance to misclassify one.

// The catalog carries a few names with trailing whitespace ("Dystopian ",
// "Parody "), so every lookup normalises rather than comparing raw strings.
function normalise(tag: string): string {
  return tag.trim().toLowerCase();
}

// Broad forms that are strict generalisations of at least one other entry
// below. Kept in the allowlist — a game tagged only `Action` still tells us
// something — but suppressed by `selectGenreTags` whenever a more specific
// sibling matched, so a Soulslike doesn't report itself as "Action, RPG,
// Action RPG" and spend all three slots saying one thing.
const UMBRELLA_TAGS = [
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Simulation",
  "Sports",
  "Shooter",
  "Puzzle",
  "Horror",
  "Platformer",
  "Roguelike",
  "Racing",
  "Card Game",
  "Management",
  "Fighting",
  "Flight",
] as const;

const SPECIFIC_TAGS = [
  // Action and combat forms
  "Action-Adventure",
  "Action RPG",
  "Action Roguelike",
  "Action RTS",
  "Arena Shooter",
  "Battle Royale",
  "Beat 'em up",
  "Boomer Shooter",
  "Boss Rush",
  "Bullet Heaven",
  "Bullet Hell",
  "Character Action Game",
  "Combat Racing",
  "Extraction Shooter",
  "FPS",
  "Hack and Slash",
  "Hero Shooter",
  "Immersive Sim",
  "Looter Shooter",
  "Metroidvania",
  "Musou",
  "Naval Combat",
  "On-Rails Shooter",
  "Rail Shooter",
  "Shoot 'Em Up",
  "Souls-like",
  "Spectacle fighter",
  "Stealth",
  "Third-Person Shooter",
  "Top-Down Shooter",
  "Twin Stick Shooter",
  "Vehicular Combat",

  // Roguelike and dungeon forms
  "Dungeon Crawler",
  "Mystery Dungeon",
  "Roguelike Deckbuilder",
  "Roguelite",
  "Roguevania",
  "Traditional Roguelike",

  // Platforming
  "Precision Platformer",
  "Puzzle Platformer",
  "Runner",

  // RPG forms
  "CRPG",
  "JRPG",
  "MMORPG",
  "Party-Based RPG",
  "Strategy RPG",
  "Tactical RPG",

  // Narrative forms
  "Dating Sim",
  "Escape Room",
  "Hidden Object",
  "Interactive Fiction",
  "Otome",
  "Point & Click",
  "Visual Novel",
  "Walking Simulator",

  // Strategy forms
  "4X",
  "Auto Battler",
  "City Builder",
  "Colony Sim",
  "God Game",
  "Grand Strategy",
  "MOBA",
  "RTS",
  "Real Time Tactics",
  "Tower Defense",
  "Turn-Based Strategy",
  "Turn-Based Tactics",
  "Wargame",

  // Simulation forms
  "Automation",
  "Automobile Sim",
  "Combat Flight Simulator",
  "Cooking",
  "Farming",
  "Farming Sim",
  "Fishing",
  "Hobby Sim",
  "Hunting",
  "Job Simulator",
  "Life Sim",
  "Medical Sim",
  "Outbreak Sim",
  "Political Sim",
  "Sandbox",
  "Space Sim",
  "Time Management",

  // Survival and horror
  "Open World Survival Craft",
  "Psychological Horror",
  "Survival",
  "Survival Horror",

  // Puzzle, board and card forms
  "Board Game",
  "Card Battler",
  "Chess",
  "Deckbuilding",
  "Falling Blocks",
  "Mahjong",
  "Match 3",
  "Pinball",
  "Poker",
  "Sokoban",
  "Solitaire",
  "Tabletop",
  "Trading Card Game",
  "Trivia",
  "Word Game",

  // Idle forms
  "Clicker",
  "Idler",
  "Incremental",

  // Rhythm
  "Rhythm",

  // Social forms
  "Party Game",
  "Social Deduction",

  // Edutainment
  "Education",

  // Individual sports. Steam tags these alongside `Sports`, and the specific
  // one is far more characterful — "Golf" says something "Sports" doesn't.
  "Archery",
  "Baseball",
  "Basketball",
  "Billiards",
  "Bowling",
  "Boxing",
  "Cricket",
  "Cycling",
  "Football (American)",
  "Football (Soccer)",
  "Golf",
  "Hockey",
  "Mini Golf",
  "Motocross",
  "Pool",
  "Rugby",
  "Skateboarding",
  "Skating",
  "Skiing",
  "Snooker",
  "Snowboarding",
  "Tennis",
  "Volleyball",
  "Wrestling",
] as const;

/**
 * How far down a game's weight-ordered tag list to look for genres.
 *
 * An allowlist cannot tell a genre tag applied sincerely from the same tag
 * applied as a joke, and Steam's community reliably parks its jokes at the
 * bottom: measured 2026-08-01, `Dating Sim` is rank 20 on ELDEN RING
 * NIGHTREIGN, `Rhythm` is rank 19 on Sekiro, and `Stealth` is rank 20 on PUBG.
 * Genuine genres cluster in the top dozen — Nightreign carries Souls-like at
 * 1, Roguelike at 4, Roguelite at 10, Action RPG at 11.
 *
 * 12 was picked by sweeping the owner's library: every limit at or below 14
 * removes the meme tags completely, and none of them costs any coverage — the
 * count of cohort games left with no genre signal stays at 1 (a single
 * unenriched app) from 8 all the way to 20. 12 sits with margin below the
 * memes and still above where real secondary genres appear.
 */
export const GENRE_TAG_RANK_LIMIT = 12;

/** Every tag the Portrait treats as a genre, umbrella and specific alike. */
export const PORTRAIT_GENRE_TAGS: readonly string[] = [
  ...UMBRELLA_TAGS,
  ...SPECIFIC_TAGS,
];

const GENRE_LOOKUP = new Set(PORTRAIT_GENRE_TAGS.map(normalise));
const UMBRELLA_LOOKUP = new Set(UMBRELLA_TAGS.map(normalise));

/** True when the tag names a genre rather than a descriptor. */
export function isGenreTag(tag: string): boolean {
  return GENRE_LOOKUP.has(normalise(tag));
}

/** True when the tag is a genre that some other allowlisted genre refines. */
export function isUmbrellaGenreTag(tag: string): boolean {
  return UMBRELLA_LOOKUP.has(normalise(tag));
}

/**
 * The genre tags of one game, in the order Steam weighted them, with the joke
 * tail truncated and umbrella tags dropped when anything more specific
 * survived. Returns an empty array for a game whose tags are all descriptors —
 * the caller must treat that as "no genre signal" rather than falling back to
 * the raw list.
 *
 * `tags` must arrive in Steam's weight order, which is how `tagIds` is stored.
 * Passing a sorted or de-duplicated list silently defeats the rank limit.
 */
export function selectGenreTags(
  tags: Iterable<string>,
  rankLimit = GENRE_TAG_RANK_LIMIT
): string[] {
  const genres = [...tags].slice(0, rankLimit).filter(isGenreTag);
  const specific = genres.filter((tag) => !isUmbrellaGenreTag(tag));
  return specific.length > 0 ? specific : genres;
}
