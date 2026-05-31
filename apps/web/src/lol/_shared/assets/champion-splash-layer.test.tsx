import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ChampionSplashLayer from "./champion-splash-layer";

vi.mock("blurhash", () => ({
  decode: (_hash: string, w: number, h: number) => new Uint8ClampedArray(w * h * 4),
}));

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "14.20",
}));

vi.mock("@/lol/_shared/assets/champion-theme", () => ({
  championTheme: () => ({ blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj", primary: "#1a3a5c" }),
}));

const SPLASH_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  championBackdropSplashUrl: () => SPLASH_URL,
}));

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => ({
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => {},
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    value: () => "data:image/png;base64,test",
    configurable: true,
    writable: true,
  });
});

function countSplashImgs(root: HTMLElement) {
  return root.querySelectorAll(`img[src="${SPLASH_URL}"]`).length;
}

describe("ChampionSplashLayer", () => {
  // happy-dom's matchMedia returns matches:false for every query, so
  // useReducedMotion resolves to false and the foreground plane renders.
  // The reduced-motion branch (single plane) is a single ternary covered by
  // visual review; motion caches its media-query subscription across tests,
  // which makes a second test in this file fight the cache.
  it("renders background + foreground splash planes", () => {
    const { container } = render(<ChampionSplashLayer champion="Ahri" offsetX={0} />);
    expect(countSplashImgs(container)).toBe(2);
  });
});
