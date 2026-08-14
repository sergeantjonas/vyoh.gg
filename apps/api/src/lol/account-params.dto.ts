import { IsIn, IsString, Length, Matches } from "class-validator";
import { PLATFORMS } from "../riot/regions";

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

export class BaselineParamsDto extends AccountParamsDto {
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9]{0,29}$/)
  championAlias!: string;

  @IsIn(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"])
  role!: string;
}
