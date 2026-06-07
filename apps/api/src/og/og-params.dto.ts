import { IsString, Matches, MinLength } from "class-validator";

// One slug param + one Riot matchId. Used by the per-account match card. The
// matchId pattern matches Riot's `<PLATFORM>_<NUMERIC_ID>` shape (EUW1_42…).
export class OgMatchParamsDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @Matches(/^[A-Z0-9]+_\d+$/)
  matchId!: string;
}

// Alias of the per-account match params; the original DTO name. Kept exported
// under the historical name so any external import (none in this repo today,
// but external snapshots of the service might) doesn't break — slim cost.
export { OgMatchParamsDto as OgParamsDto };

// Slug-only param for the profile card endpoint. Same casing/min-length rules
// as `OgMatchParamsDto.slug`.
export class OgSlugDto {
  @IsString()
  @MinLength(1)
  slug!: string;
}

// Champion alias param — letters/digits only (Riot aliases like `JarvanIV`,
// `MonkeyKing`, `KSante`). Case-insensitive equals at the DB layer handles
// any lowercased variant.
export class OgChampionAliasDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]+$/)
  alias!: string;
}

// Steam appid param — numeric, four-to-seven digits in practice. We don't
// upper-bound because Steam keeps allocating new ids.
export class OgSteamAppidDto {
  @IsString()
  @Matches(/^\d+$/)
  appid!: string;
}
