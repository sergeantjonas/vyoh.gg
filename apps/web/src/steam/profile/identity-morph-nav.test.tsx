import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// supportsViewTransitions is gated on the engine; force it on so the driver
// runs its active path under happy-dom (which lacks startViewTransition).
vi.mock("@/lib/view-transition-nav", () => ({
  supportsViewTransitions: () => true,
}));
// isWebKit defaults to false (non-Safari path). Tests that exercise the
// WebKit-bail flip the mock per-test.
vi.mock("@/lib/is-webkit", () => ({
  isWebKit: vi.fn(() => false),
}));
vi.mock("@/lib/navigation-type", () => ({
  getNavigationType: vi.fn(() => ["slide-left"]),
}));
vi.mock("@/lib/scroll-container", () => ({
  mainScrollRef: { current: null },
}));

import { isWebKit } from "@/lib/is-webkit";
import { getNavigationType } from "@/lib/navigation-type";
import {
  STEAM_IDENTITY_AVATAR_MORPH_ID,
  STEAM_IDENTITY_NAME_MORPH_ID,
} from "./identity-layout";
import { runSteamIdentityMorphNav } from "./identity-morph-nav";

const navType = vi.mocked(getNavigationType);
const webKit = vi.mocked(isWebKit);

type StartVT = (cb: () => Promise<void>) => {
  finished: Promise<void>;
  types: Set<string>;
};

let capturedCallback: (() => Promise<void>) | null = null;
let lastTypes: Set<string>;
let resolveFinished: () => void;

function stubStartViewTransition(): void {
  lastTypes = new Set<string>();
  // `finished` stays pending until a test resolves it — see LoL driver test.
  const finished = new Promise<void>((res) => {
    resolveFinished = res;
  });
  const start: StartVT = (cb) => {
    capturedCallback = cb;
    return { finished, types: lastTypes };
  };
  (document as unknown as { startViewTransition?: StartVT }).startViewTransition = start;
}

// Insert the marked avatar + name; `inMain` wraps them in `[data-vt-main]`
// (the hero lives inside <main>; the strip is portaled outside it).
function mountIdentity(inMain: boolean): { avatar: HTMLElement; name: HTMLElement } {
  const host = document.createElement("div");
  if (inMain) host.setAttribute("data-vt-main", "");
  const avatar = document.createElement("img");
  avatar.setAttribute("data-identity-avatar", "");
  const name = document.createElement("h2");
  name.setAttribute("data-identity-name", "");
  host.append(avatar, name);
  document.body.append(host);
  return { avatar, name };
}

function clearIdentity(): void {
  for (const el of document.querySelectorAll(
    "[data-identity-avatar],[data-identity-name]"
  )) {
    el.closest("div")?.remove();
  }
}

beforeEach(() => {
  capturedCallback = null;
  navType.mockReturnValue(["slide-left"]);
  webKit.mockReturnValue(false);
  document.body.innerHTML = "";
  document.body.dataset.vtShell = "off";
  stubStartViewTransition();
});

afterEach(() => {
  (document as unknown as Record<string, unknown>).startViewTransition = undefined;
});

describe("runSteamIdentityMorphNav", () => {
  it("takes over a Profile→tab nav (hero source) and names the source for the OLD snapshot", () => {
    const hero = mountIdentity(true);
    const navigate = vi.fn(async () => {});
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam",
      toPathname: "/steam/library",
      toIsProfileIndex: false,
      navigate,
    });
    expect(took).toBe(true);
    // Source named synchronously so it's present at OLD-snapshot capture.
    expect(hero.avatar.style.viewTransitionName).toBe(STEAM_IDENTITY_AVATAR_MORPH_ID);
    expect(hero.name.style.viewTransitionName).toBe(STEAM_IDENTITY_NAME_MORPH_ID);
    expect(document.body.dataset.vtShell).toBe("on");
    expect(lastTypes.has("slide-left")).toBe(true);
  });

  it("clears the source then navigates (viewTransition:false) then names the destination", async () => {
    const hero = mountIdentity(true);
    const navigate = vi.fn(async () => {
      // Simulate the route commit: hero unmounts, strip mounts outside <main>.
      clearIdentity();
      mountIdentity(false);
    });
    runSteamIdentityMorphNav({
      fromPathname: "/steam",
      toPathname: "/steam/library",
      toIsProfileIndex: false,
      navigate,
    });
    expect(capturedCallback).toBeTruthy();
    await capturedCallback?.();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(hero.avatar.style.viewTransitionName).toBeFalsy();
    const destAvatar = document.querySelector<HTMLElement>("[data-identity-avatar]");
    expect(destAvatar?.style.viewTransitionName).toBe(STEAM_IDENTITY_AVATAR_MORPH_ID);
  });

  it("clears the shell flag and the identity names once the transition finishes", async () => {
    const hero = mountIdentity(true);
    runSteamIdentityMorphNav({
      fromPathname: "/steam",
      toPathname: "/steam/library",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    await capturedCallback?.();
    expect(document.body.dataset.vtShell).toBe("on");
    resolveFinished();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.dataset.vtShell).toBe("off");
    expect(hero.avatar.style.viewTransitionName).toBeFalsy();
    expect(hero.name.style.viewTransitionName).toBeFalsy();
  });

  it("takes over a tab→Profile nav even when the source is the strip (dest is the hero)", () => {
    mountIdentity(false); // strip source, outside <main>
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam/library",
      toPathname: "/steam",
      toIsProfileIndex: true,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(true);
  });

  it("declines a tab→tab nav (strip source, no hero on either end)", () => {
    mountIdentity(false); // strip source
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam/library",
      toPathname: "/steam/wishlist",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
    expect(document.body.dataset.vtShell).toBe("off");
  });

  it("declines when the navigation isn't a sibling slide (cross-section)", () => {
    mountIdentity(true);
    navType.mockReturnValue(["cross-section"]);
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam",
      toPathname: "/lol/vyoh-euw",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
  });

  it("declines when getNavigationType returns false (e.g. library↔game-detail pair)", () => {
    mountIdentity(true);
    // navigation-type.ts returns `false` for Steam library↔game-detail to
    // skip router VT — the morph driver must also skip in that case so it
    // doesn't fight the per-element morph that owns those navs.
    navType.mockReturnValue(false as unknown as Array<string>);
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam/library",
      toPathname: "/steam/game/440",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
  });

  it("declines when there's no marked identity in the DOM", () => {
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam",
      toPathname: "/steam/library",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
  });

  it("declines (early-bail) on WebKit so Safari falls through to the CSS slide", () => {
    // The whole reason this driver exists is Profile↔tab morph parity with
    // LoL. But on WebKit the snapshot capture cost is what we paid the
    // Steam intra-section bypass to avoid — running a second hand-rolled VT
    // here would re-introduce it. Bail before doing anything observable.
    webKit.mockReturnValue(true);
    mountIdentity(true);
    const took = runSteamIdentityMorphNav({
      fromPathname: "/steam",
      toPathname: "/steam/library",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
    expect(document.body.dataset.vtShell).toBe("off");
  });
});
