import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "./lib/api-url";

// The module calls `Sentry.init` at import, so each case re-imports it against
// the navigator it means to describe, with the SDK mocked out so no global
// handler is ever installed.
const { init, scope } = vi.hoisted(() => ({
  init: vi.fn(),
  scope: { setTag: vi.fn(), setFingerprint: vi.fn(), setLevel: vi.fn() },
}));
vi.mock("@sentry/react", () => ({
  init,
  captureException: vi.fn(),
  withScope: (callback: (s: typeof scope) => void) => callback(scope),
}));

const CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";

async function loadWith(navigator: { webdriver: boolean; userAgent: string }) {
  vi.stubGlobal("navigator", navigator);
  vi.resetModules();
  return import("./instrument");
}

describe("instrument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["driven by automation", { webdriver: true, userAgent: CHROME }, false],
    [
      "announcing itself as headless",
      { webdriver: false, userAgent: CHROME.replace("Chrome", "HeadlessChrome") },
      false,
    ],
    ["used by a person", { webdriver: false, userAgent: CHROME }, true],
  ])("decides whether to report from a browser %s", async (_, navigator, enabled) => {
    await loadWith(navigator);

    expect(init).toHaveBeenCalledWith(expect.objectContaining({ enabled }));
  });

  it.each([
    `Failed to fetch (${new URL(API_URL).host})`,
    "Failed to fetch",
    "Load failed",
    "NetworkError when attempting to fetch resource.",
  ])("files an unanswered api fetch (%s) under one warning issue", async (message) => {
    const { captureAppError } = await loadWith({ webdriver: false, userAgent: CHROME });

    captureAppError(new TypeError(message), "query");

    expect(scope.setFingerprint).toHaveBeenCalledWith(["api-unreachable"]);
    expect(scope.setLevel).toHaveBeenCalledWith("warning");
  });

  it.each([
    "Failed to fetch (ddragon.leagueoflegends.com)",
    "Failed to fetch dynamically imported module: https://vyoh.gg/assets/route.js",
    "Cannot read properties of undefined",
  ])("leaves %s to default grouping", async (message) => {
    const { captureAppError } = await loadWith({ webdriver: false, userAgent: CHROME });

    captureAppError(new TypeError(message), "query");

    expect(scope.setFingerprint).not.toHaveBeenCalled();
    expect(scope.setLevel).not.toHaveBeenCalled();
  });
});
