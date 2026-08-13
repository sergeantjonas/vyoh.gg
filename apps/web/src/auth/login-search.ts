/** The three ways `GET /auth/github/callback` can bounce a visitor to `/login`. */
export type LoginError = "state" | "github" | "forbidden";

export function isLoginError(value: unknown): value is LoginError {
  return value === "state" || value === "github" || value === "forbidden";
}

/**
 * Narrow `?next=` to a same-site path, mirroring `safeNextPath` in the api's
 * `oauth-state.ts`.
 *
 * Checked again here rather than trusted because the two uses are different:
 * the api validates what it signs into the state, while this value is read
 * straight off the URL bar and handed back to `LoginButton`, which puts it in
 * an href. Anyone can craft `/login?next=https://evil.example`, and without
 * this the login button on that page would point off-site.
 */
export function safeNext(next: unknown): string | undefined {
  if (typeof next !== "string" || next === "") return undefined;
  if (!next.startsWith("/")) return undefined;
  // `//evil.example` is protocol-relative and leaves the site; browsers
  // normalise the backslash form to the same thing.
  if (next.startsWith("//") || next.startsWith("/\\")) return undefined;
  if (/[\r\n]/.test(next)) return undefined;
  return next;
}
