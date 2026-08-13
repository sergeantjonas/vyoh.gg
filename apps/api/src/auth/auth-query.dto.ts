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
}
