import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Every test starts with a `fetch` that refuses to reach the network and
// records the attempt. A test that triggers a real request fails in `afterEach`
// naming the URL, instead of quietly succeeding.
//
// This exists because ten test files were rendering components that hit
// `http://localhost:2010` (the api dev server) and
// `https://ddragon.leagueoflegends.com` for real. It read as a CI-only problem
// because the two environments fail at different points: on a dev machine the
// api answers, so the request is still in flight when vitest tears down the
// happy-dom window and you get `AbortError` from `Fetch.onAsyncTaskManagerAbort`;
// on CI nothing is listening, so you get `ECONNREFUSED ::1:2010`. Same leak,
// and neither symptom failed anything, so it survived for months.
//
// The dangerous half is not the noise. It is that those tests were passing
// partly because the owner's dev server happened to be running, which makes
// them green for a reason unrelated to their assertions.
//
// Stubbing your own `fetch` (`vi.stubGlobal`, `vi.spyOn`, or assigning
// `globalThis.fetch`) replaces this recorder, so the guard never fires for a
// test that mocks properly. `mockLolStaticFetch` in
// `lol/_shared/static/mock-lol-static.ts` is the usual way in, and already
// handles the ddragon version URL.
let unmockedFetches: string[] = [];

beforeEach(() => {
  unmockedFetches = [];
  globalThis.fetch = vi.fn((input: unknown) => {
    const url = String(input);
    unmockedFetches.push(url);
    return Promise.reject(new Error(`unmocked fetch in test: ${url}`));
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  if (unmockedFetches.length > 0) {
    const urls = [...new Set(unmockedFetches)].join("\n  ");
    const count = unmockedFetches.length;
    unmockedFetches = [];
    throw new Error(
      `This test made ${count} unmocked fetch call(s):\n  ${urls}\n\nStub fetch rather than letting it reach the network: mockFetchRoutes() from lol/_shared/static/mock-lol-static covers the common case, mockFetchRoutes({ "/some/path": body }) when the response matters. Tests must not depend on a running dev server.`
    );
  }
});
