import type { QueryClient } from "@tanstack/react-query";
import { viewerQueryKey } from "./use-viewer";

/**
 * Seeds the viewer query so `useIsOwner()` resolves without a request.
 *
 * Every viewer-scoped read pulls the viewer in, which otherwise trips the
 * unmocked-fetch guard in `test-setup.ts` — and where a test *does* stub fetch,
 * a single mocked `Response` has a body that can only be read once, so the
 * viewer query would consume it before the request under test.
 *
 * Pass `true` to render as the owner.
 */
export function seedViewer(client: QueryClient, isOwner = false): void {
  client.setQueryData(viewerQueryKey, { isOwner });
}
