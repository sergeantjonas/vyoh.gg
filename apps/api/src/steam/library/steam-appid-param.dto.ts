import { Type } from "class-transformer";
import { IsInt, IsPositive } from "class-validator";

// Path params arrive as strings; `@Type` is what turns "440" into 440 before
// the integer check runs (the global pipe transforms, but does not coerce
// implicitly).
export class SteamAppidParamDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  appid!: number;
}
