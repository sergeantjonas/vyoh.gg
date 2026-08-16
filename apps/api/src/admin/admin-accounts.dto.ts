import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { PLATFORMS } from "../riot/regions";

// A slug is both a URL path segment (`/lol/<slug>/matches`) and the `LolAccount`
// primary key, so its shape is pinned at the boundary rather than trusted. A
// slug carrying a slash or a percent produces a roster row whose own routes
// resolve to nothing, and reads as fine in the admin table.
const SLUG = /^[a-z0-9][a-z0-9-]{0,29}$/;

export class CreateLolAccountDto {
  @IsString()
  @Matches(SLUG)
  slug!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[\p{L}\p{N}\p{Cf} ._-]+$/u)
  gameName!: string;

  @IsString()
  @Length(3, 5)
  @Matches(/^[A-Za-z0-9]+$/)
  tagLine!: string;

  @IsIn(PLATFORMS)
  region!: string;

  @IsOptional()
  @IsBoolean()
  isOwner?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

/**
 * Every field optional, and the slug, Riot-ID tuple, and region absent
 * entirely: renaming a slug needs redirect handling on the URL surface, and
 * re-pointing a row at a different Riot ID would silently re-attribute its
 * synced history. Both are out of scope for v1 — remove and re-add instead.
 *
 * `hidden` and `syncPaused` are booleans here while the columns are nullable
 * timestamps. The api owns the clock: a client that could send its own
 * "hidden since" would let a wrong device clock write a hidden-in-the-future
 * roster row.
 */
export class UpdateLolAccountDto {
  @IsOptional()
  @IsBoolean()
  isOwner?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsBoolean()
  syncPaused?: boolean;
}

export class LolAccountSlugParamDto {
  @IsString()
  @Matches(SLUG)
  slug!: string;
}

/**
 * Deleting an account that still has match rows is refused by default and
 * overridden with `?force=true`. Declared as a string union rather than a
 * transformed boolean because the global `ValidationPipe` only coerces types it
 * has been told about, and `force=1` or `force=yes` silently arriving as `true`
 * is the wrong failure mode for the one destructive route in this module.
 */
export class DeleteLolAccountQueryDto {
  @IsOptional()
  @IsIn(["true", "false"])
  force?: string;
}

/**
 * Purge asks for the slug back in the body, and the service checks it against
 * the path segment. The dialog already makes the operator type it, so this adds
 * nothing to the UI — it exists for everything that is not the dialog. Purge is
 * the only irreversible route in the api, and a path-only POST is one stray
 * `curl` away from destroying an account's history; requiring the name in two
 * places means the request has to be about a specific account on purpose.
 */
export class PurgeLolAccountDto {
  @IsString()
  @Matches(SLUG)
  confirm!: string;
}
