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
  "AurelionSol",
  "Brand",
  "Camille",
  "Darius",
  "Draven",
  "Ekko",
  "Ezreal",
  "Gangplank",
  "Galio",
  "Hecarim",
  "Hwei",
  "Illaoi",
  "Irelia",
  "Jayce",
  "KSante",
  "Kayn",
  "Khazix",
  "Kled",
  "LeeSin",
  "Lillia",
  "Lucian",
  "MasterYi",
  "Mel",
  "Milio",
  "MissFortune",
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
  "Senna",
  "Sett",
  "Sivir",
  "Smolder",
  "Taliyah",
  "Talon",
  "Trundle",
  "Twitch",
  "Vayne",
  "Veigar",
  "Vex",
  "Vi",
  "Viktor",
  "Vladimir",
  "Xayah",
  "XinZhao",
  "Zaahen",
  "Zeri",
]);

export function shouldFlipChampion(championName: string): boolean {
  return !FACING_RIGHT.has(championName);
}
