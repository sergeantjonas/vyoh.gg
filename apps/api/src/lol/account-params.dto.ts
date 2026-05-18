import { IsIn, IsString, Length, Matches } from "class-validator";

// Mirror of Platform union in ../riot/regions.ts — keep in sync when adding platforms.
const PLATFORMS = [
  "euw1",
  "eun1",
  "tr1",
  "ru",
  "me1",
  "na1",
  "br1",
  "la1",
  "la2",
  "kr",
  "jp1",
  "oc1",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2",
];

export class AccountParamsDto {
  @IsIn(PLATFORMS)
  region!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[\p{L}\p{N}\p{Cf} ._-]+$/u)
  gameName!: string;

  @IsString()
  @Length(3, 5)
  @Matches(/^[A-Za-z0-9]+$/)
  tagLine!: string;
}

export class ChampionAccountParamsDto extends AccountParamsDto {
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9]{0,29}$/)
  championKey!: string;
}
