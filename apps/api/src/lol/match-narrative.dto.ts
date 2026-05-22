import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches } from "class-validator";

// Riot match IDs look like "EUW1_7849561729" — uppercase platform prefix,
// underscore, numeric body. Bound the array to keep the IN-query cheap.
export class NarrativeWindowDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Matches(/^[A-Z0-9]{2,5}_[0-9]+$/, { each: true })
  matchIds!: string[];
}
