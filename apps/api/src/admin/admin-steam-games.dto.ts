import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Booleans here against nullable timestamp columns, for the reason
 * `UpdateLolAccountDto` gives: the api owns the clock. A client that could send
 * its own "hidden since" would let a wrong device clock write a row hidden in
 * the future, and a row hidden in the future is a row that is visible now.
 *
 * `reviewed` is separate from `hidden` rather than implied by it. Approving a
 * quarantined game and hiding it for good are both rulings, and both clear the
 * needs-review badge; what they differ on is `hidden`. Folding review into the
 * visibility change would make "leave it quarantined but write a note" or
 * "revisit this later" unexpressible.
 */
export class UpdateSteamGameCurationDto {
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsBoolean()
  unfeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /**
   * Only used when the request creates the row. An appid can be curated before
   * it is owned — pre-hiding a game you are about to buy is the point — and in
   * that case there is no library row to take a name from.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
