import { IsString, Matches } from "class-validator";

export class MatchIdParamDto {
  @IsString()
  @Matches(/^[A-Z0-9]+_\d+$/)
  matchId!: string;
}
