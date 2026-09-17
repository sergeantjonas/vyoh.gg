import { IsOptional, IsString, MaxLength } from "class-validator";

export class LoginQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  next?: string;
}

/**
 * Everything GitHub can put on the callback, because the global ValidationPipe
 * runs `forbidNonWhitelisted` — an undeclared param is a 400, and the
 * `error_*` trio is exactly what arrives when the owner clicks Cancel. Values
 * are validated as strings and never reflected back into a response.
 */
export class GithubCallbackQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  error?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  error_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  error_uri?: string;

  /**
   * RFC 9207 issuer identifier. GitHub sends it on the authorisation response,
   * so an app that does not declare it answers 400 to every real login. The
   * controller checks the value rather than merely tolerating it — the
   * parameter exists so a client talking to several authorisation servers can
   * detect one server's response replayed as another's.
   */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  iss?: string;
}
