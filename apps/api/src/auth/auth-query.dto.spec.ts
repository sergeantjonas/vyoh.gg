import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { GithubCallbackQueryDto } from "./auth-query.dto";

/**
 * Mirrors the global pipe in main.ts. Without `forbidNonWhitelisted` these
 * assertions pass against a DTO that would 400 in production, which is the
 * failure this file exists to catch.
 */
function fail(params: object): string[] {
  return validateSync(plainToInstance(GithubCallbackQueryDto, params), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);
}

describe("GithubCallbackQueryDto", () => {
  it("accepts the success response", () => {
    expect(fail({ code: "abc", state: "signed.token" })).toEqual([]);
  });

  it("accepts the RFC 9207 issuer GitHub sends alongside the code", () => {
    expect(
      fail({ code: "abc", state: "signed.token", iss: "https://github.com/login/oauth" })
    ).toEqual([]);
  });

  it("accepts the cancel response", () => {
    expect(
      fail({
        state: "signed.token",
        error: "access_denied",
        error_description: "The user has denied your application access.",
        error_uri: "https://docs.github.com/apps/troubleshooting",
      })
    ).toEqual([]);
  });

  it("rejects a parameter GitHub does not send", () => {
    expect(fail({ code: "abc", state: "signed.token", surprise: "x" })).toContain(
      "surprise"
    );
  });
});
