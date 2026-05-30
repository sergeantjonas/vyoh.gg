import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// supportsViewTransitions is gated on the engine; force it on so the driver
// runs its active path under happy-dom (which lacks startViewTransition).
vi.mock("@/lib/view-transition-nav", () => ({
  supportsViewTransitions: () => true,
}));
vi.mock("@/lib/navigation-type", () => ({
  getNavigationType: vi.fn(() => ["slide-left"]),
}));
vi.mock("@/lib/scroll-container", () => ({
  mainScrollRef: { current: null },
}));

import { getNavigationType } from "@/lib/navigation-type";
import { IDENTITY_AVATAR_MORPH_ID, IDENTITY_NAME_MORPH_ID } from "./identity-layout";
import { runIdentityMorphNav } from "./identity-morph-nav";

const navType = vi.mocked(getNavigationType);

type StartVT = (cb: () => Promise<void>) => {
  finished: Promise<void>;
  types: Set<string>;
};

let capturedCallback: (() => Promise<void>) | null = null;
let lastTypes: Set<string>;

function stubStartViewTransition(): void {
  lastTypes = new Set<string>();
  const start: StartVT = (cb) => {
    capturedCallback = cb;
    return { finished: Promise.resolve(), types: lastTypes };
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
  for (const el of document.querySelectorAll("[data-identity-avatar],[data-identity-name]")) {
    el.closest("div")?.remove();
  }
}

beforeEach(() => {
  capturedCallback = null;
  navType.mockReturnValue(["slide-left"]);
  document.body.innerHTML = "";
  document.body.dataset.vtShell = "off";
  stubStartViewTransition();
});

afterEach(() => {
  (document as unknown as { startViewTransition?: StartVT }).startViewTransition = undefined;
});

describe("runIdentityMorphNav", () => {
  it("takes over a Profile→tab nav (hero source) and names the source for the OLD snapshot", () => {
    const hero = mountIdentity(true);
    const navigate = vi.fn(async () => {});
    const took = runIdentityMorphNav({
      fromPathname: "/lol/vyoh-euw",
      toPathname: "/lol/vyoh-euw/matches",
      toIsProfileIndex: false,
      navigate,
    });
    expect(took).toBe(true);
    // Source named synchronously so it's present at OLD-snapshot capture.
    expect(hero.avatar.style.viewTransitionName).toBe(IDENTITY_AVATAR_MORPH_ID);
    expect(hero.name.style.viewTransitionName).toBe(IDENTITY_NAME_MORPH_ID);
    // Shell slide is driven alongside the morph.
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
    runIdentityMorphNav({
      fromPathname: "/lol/vyoh-euw",
      toPathname: "/lol/vyoh-euw/matches",
      toIsProfileIndex: false,
      navigate,
    });
    expect(capturedCallback).toBeTruthy();
    await capturedCallback?.();
    expect(navigate).toHaveBeenCalledTimes(1);
    // Source name was cleared before the destination rendered.
    expect(hero.avatar.style.viewTransitionName).toBeFalsy();
    // Destination (the freshly mounted strip) carries the morph name.
    const destAvatar = document.querySelector<HTMLElement>("[data-identity-avatar]");
    expect(destAvatar?.style.viewTransitionName).toBe(IDENTITY_AVATAR_MORPH_ID);
  });

  it("takes over a tab→Profile nav even when the source is the strip (dest is the hero)", () => {
    mountIdentity(false); // strip source, outside <main>
    const took = runIdentityMorphNav({
      fromPathname: "/lol/vyoh-euw/matches",
      toPathname: "/lol/vyoh-euw",
      toIsProfileIndex: true,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(true);
  });

  it("declines a tab→tab nav (strip source, no hero on either end)", () => {
    mountIdentity(false); // strip source
    const took = runIdentityMorphNav({
      fromPathname: "/lol/vyoh-euw/matches",
      toPathname: "/lol/vyoh-euw/trends",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
    expect(document.body.dataset.vtShell).toBe("off");
  });

  it("declines when the navigation isn't a sibling slide", () => {
    mountIdentity(true);
    navType.mockReturnValue(["cross-section"]);
    const took = runIdentityMorphNav({
      fromPathname: "/lol/vyoh-euw",
      toPathname: "/steam",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
  });

  it("declines when there's no marked identity in the DOM", () => {
    const took = runIdentityMorphNav({
      fromPathname: "/lol/vyoh-euw",
      toPathname: "/lol/vyoh-euw/matches",
      toIsProfileIndex: false,
      navigate: vi.fn(async () => {}),
    });
    expect(took).toBe(false);
  });
});
