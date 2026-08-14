import { API_URL } from "./api-url";
import { HttpError } from "./http-error";

/**
 * A request against an `OwnerGuard`-protected route.
 *
 * `credentials: "include"` is the load-bearing part: in dev the api answers on
 * a different port, which is a different *origin* even though it is the same
 * site, so the session cookie is only attached when the request asks for it.
 * Omit it and every gated call 401s in dev while working in production.
 */
export async function ownerRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!res.ok) {
    // The guard's own "Owner session required" is accurate but reads as an
    // internal error; the user's situation is that they were signed in a moment
    // ago and are not now.
    if (res.status === 401) throw new HttpError(401, "Session expired — sign in again");
    let message = `HTTP ${res.status}`;
    try {
      const parsed = await res.json();
      // Nest sends `message` as an array when a DTO fails validation — several
      // fields can be wrong at once, and the form wants all of them.
      if (typeof parsed?.message === "string") message = parsed.message;
      else if (Array.isArray(parsed?.message)) message = parsed.message.join(". ");
    } catch {
      // not JSON
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}
