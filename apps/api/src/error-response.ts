// What both exception filters write, and why neither can simply call
// `res.status().json()`. The image and OG routes declare their Content-Type
// and Cache-Control through `@Header`, which Nest applies before the handler
// runs, and Express's `res.json` leaves an existing Content-Type alone. So an
// error body inherits both: JSON labelled `image/png`, cached as long as the
// success would have been — a year on the image proxy, thirty days on an OG
// card — and nginx honours either over its own `proxy_cache_valid` list.
export interface ErrorResponseTarget {
  headersSent?: boolean;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
}

// A 5xx or a 429 means "not now" rather than "never", so neither may be
// cached. A deliberate 4xx keeps whatever caching the route declared.
function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export function sendErrorBody(
  response: ErrorResponseTarget,
  status: number,
  body: unknown
): void {
  // A throw after the headers are out (a streaming route mid-stream) has no
  // response left to shape; writing would only raise a second error.
  if (response.headersSent) return;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (isTransientStatus(status)) response.setHeader("Cache-Control", "no-store");
  response.status(status).json(body);
}
