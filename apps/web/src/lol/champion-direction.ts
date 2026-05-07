// CDragon centered splashes — most champions face the viewer's LEFT, so
// we flip by default so everyone consistently faces RIGHT (toward the
// stats column on the match card). The set below lists the exceptions:
// champions whose natural splash already faces right (or close enough
// that flipping would make them point away from the stats).
//
// Bootstrapped by visually classifying every champion's centered splash
// from CDragon. Names use Riot's internal alias (Match-V5 `championName`)
// — e.g. "MonkeyKing" for Wukong, "Khazix" for Kha'Zix.
const FACING_RIGHT = new Set<string>([
  "Akshan",
  "Ambessa",
  "Brand",
  "Briar",
  "Camille",
  "Darius",
  "Draven",
  "Ekko",
  "Ezreal",
  "Gangplank",
  "Hecarim",
  "Hwei",
  "Illaoi",
  "Irelia",
  "JarvanIV",
  "Jayce",
  "KSante",
  "Kaisa",
  "Kayn",
  "Khazix",
  "Kled",
  "LeeSin",
  "Lucian",
  "MasterYi",
  "Mel",
  "Milio",
  "MissFortune",
  "MonkeyKing",
  "Naafiri",
  "Nilah",
  "Olaf",
  "Ornn",
  "Poppy",
  "Pyke",
  "Qiyana",
  "Rakan",
  "Rell",
  "Renata",
  "Renekton",
  "Rengar",
  "Rumble",
  "Ryze",
  "Samira",
  "Senna",
  "Sett",
  "Sivir",
  "Smolder",
  "Sona",
  "Soraka",
  "Taliyah",
  "Talon",
  "Trundle",
  "Twitch",
  "Vayne",
  "Veigar",
  "Vi",
  "Vladimir",
  "Xayah",
  "XinZhao",
  "Yasuo",
  "Yone",
  "Yuumi",
  "Zaahen",
  "Zeri",
]);

export function shouldFlipChampion(championName: string): boolean {
  return !FACING_RIGHT.has(championName);
}
