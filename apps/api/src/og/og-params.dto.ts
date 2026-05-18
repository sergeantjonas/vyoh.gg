import { IsString, Matches, MinLength } from "class-validator";

export class OgParamsDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @Matches(/^[A-Z0-9]+_\d+$/)
  matchId!: string;
}
