import { BackdropPortal } from "@/_shared/backdrop/backdrop-portal";
import { SlidePanel } from "@/_shared/slide-panel";
import { useAudio } from "@/lib/use-audio";
import { useHydratedSync } from "@/lib/use-hydrated";
import { useMediaQuery } from "@/lib/use-media-query";
import { useViewTransitionsSupported } from "@/lib/view-transition-nav";
import {
  DEFAULT_SERIOUS_QUEUE_IDS,
  SeriousQueuesProvider,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The now-playing strip's inputs, stubbed as if the owner were mid-game. The
// assertion below is only meaningful because these say "live" — with the real
// hooks the strip would render nothing for want of data rather than because the
// gate held.
vi.mock("@/home/use-primary-account", () => ({
  usePrimaryAccount: () => ({
    account: { region: "euw1", gameName: "Vyoh", tagLine: "Ahri", slug: "ahri" },
  }),
}));
vi.mock("@/lol/matches/use-live-match", () => ({
  useLiveGame: () => ({ data: { queueId: 420, gameLength: 600, polledAt: 0 } }),
}));
vi.mock("@/steam/use-player-state", () => ({
  useSteamPlayerState: () => ({ data: undefined }),
}));
vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: () => ({ data: undefined }),
}));

import { NowPlayingStrip } from "@/home/conclusion/now-playing-strip";

// Every assertion here pins the same contract: what a component renders on the
// server must not depend on the browser it is running next to. Break that and
// the client's hydrating render disagrees with the HTML it was handed, so React
// discards the server-rendered tree and re-renders the route — the page still
// works, so the only evidence is a console error, while the entire benefit of
// server-rendering that route is silently gone.
//
// These run in happy-dom, which means `window`, `matchMedia` and `localStorage`
// all exist during `renderToString`. That is exactly what makes them useful: a
// component that reads the environment instead of stating a server value fails
// here, the same way it fails against a real browser after a real SSR response.

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("server rendering does not read the browser", () => {
  it("reports a media query as unmatched on the server even when it matches", () => {
    // "(min-width: 1px)" matches in any real viewport, so this fails the moment
    // the hook goes back to reading `matchMedia` during render. Consumers branch
    // on the result — the match row only mounts its hover popover under
    // `(hover: hover)` — so disagreeing here changes the tree, not just an
    // attribute.
    function Probe() {
      return <span>{String(useMediaQuery("(min-width: 1px)"))}</span>;
    }

    expect(window.matchMedia("(min-width: 1px)").matches).toBe(true);
    expect(renderToString(<Probe />)).toContain("false");
  });

  it("renders a media-query consumer identically twice", () => {
    // The hydrating render has to reproduce the server's output. Rendering the
    // same tree twice is the cheapest stand-in for that: a hook that samples
    // anything ambient cannot hold this and the server contract at once.
    function Probe() {
      return <span>{String(useMediaQuery("(hover: hover) and (pointer: fine)"))}</span>;
    }

    expect(renderToString(<Probe />)).toBe(renderToString(<Probe />));
  });

  it("renders a slide panel's content in place rather than nothing", () => {
    // The inverse of the backdrop assertion below, and the reason PanelLayer
    // exists: a backdrop has nothing to say to a crawler, while the three
    // routes mounting a SlidePanel are the app's detail URLs. Portal-only, they
    // served a document with no content in it.
    const html = renderToString(
      <SlidePanel open onClose={() => {}} title="Match detail">
        <p>Ahri · Win · 12/2/9</p>
      </SlidePanel>
    );
    expect(html).toContain("Ahri · Win · 12/2/9");
    expect(html).toContain("Match detail");
  });

  it("renders a CountUp at its final value on the server", async () => {
    // The champion hero's numbers reach a crawler through this. Test mode
    // already bypasses the animation, so the module is re-imported under a
    // mode that would animate; the cold-arrival gate has to be what settles it.
    vi.stubEnv("MODE", "development");
    vi.resetModules();
    const { CountUp } = await import("@/components/count-up");
    expect(renderToString(<CountUp to={193} />)).toContain("193");
    // A gated CountUp holds at 0 on both sides — and this is what proves the
    // stub reached the module, since test mode would have settled it at 193.
    expect(renderToString(<CountUp to={193} start={false} />)).toContain("0");
  });

  it("reports view transitions as unsupported on the server even where they exist", () => {
    // match-hero derives a `viewTransitionName` from this. Read directly it is
    // false on the server and true on Chrome and Safari's hydrating render,
    // which is a mismatch on exactly the engines the morph is built for.
    function Probe() {
      return <span>{String(useViewTransitionsSupported())}</span>;
    }
    vi.stubGlobal("document", {
      ...globalThis.document,
      startViewTransition: () => {},
    });
    expect(renderToString(<Probe />)).toContain("false");
  });

  it("reports the tree as not yet hydrated on the server", () => {
    // The sync reader still has to answer the *server* render false, or the
    // portal it gates would be attempted where there is no DOM.
    function Probe() {
      return <span>{String(useHydratedSync())}</span>;
    }
    expect(renderToString(<Probe />)).toContain("false");
  });

  it("renders no scrim for a closed slide panel", () => {
    // Radix wraps each *portal* child in a Presence gated on `open`, so the
    // portaled path never had to say this. The in-place path has no such
    // wrapper, and without an explicit gate a closed panel painted a
    // full-screen dim over the server HTML.
    const html = renderToString(
      <SlidePanel open={false} onClose={() => {}} title="Match detail">
        <p>Ahri · Win · 12/2/9</p>
      </SlidePanel>
    );
    expect(html).not.toContain("bg-black/45");
    expect(html).not.toContain("Ahri · Win · 12/2/9");
  });

  it("renders nothing for a backdrop portal instead of throwing", () => {
    // `react-dom/server` cannot render a portal, so this has to opt out — but
    // via a hydration-aware flag, not `typeof document`, which would put the
    // client's first render on the other branch.
    expect(renderToString(<BackdropPortal>backdrop</BackdropPortal>)).toBe("");
  });

  it("renders nothing for a live-presence surface, whatever the queries hold", () => {
    // The now-playing strip is the case where client-only is the right answer
    // rather than a missed loader: it advances the clock with `Date.now()`, it
    // reads the deliberately-unprimed owned-games query, and `PresenceMounts`
    // starts its polls from the non-code-split root, so the data lands before
    // this code-split chapter hydrates. Feeding it a live game and still
    // expecting nothing is what pins the gate — drop it and the client's first
    // render produces a strip the server never emitted, and React discards `/`.
    expect(renderToString(<NowPlayingStrip />)).toBe("");
  });

  it("seeds the persisted queue selection from defaults, not from localStorage", () => {
    window.localStorage.setItem("vyoh:serious-queues", JSON.stringify([440]));

    function Probe() {
      return <span>{[...useSeriousQueues().ids].sort((a, b) => a - b).join(",")}</span>;
    }

    const html = renderToString(
      <SeriousQueuesProvider>
        <Probe />
      </SeriousQueuesProvider>
    );

    expect(html).toContain(
      [...DEFAULT_SERIOUS_QUEUE_IDS].sort((a, b) => a - b).join(",")
    );
    expect(html).not.toContain(">440<");
  });

  it("does not warn about an uncached server snapshot", () => {
    // `useSyncExternalStore` compares snapshots with Object.is, so a
    // getServerSnapshot that builds a fresh object each call never looks equal
    // to itself. React reports that as a potential infinite loop.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    function Probe() {
      return <span>{String(useAudio().enabled)}</span>;
    }
    renderToString(<Probe />);

    const messages = error.mock.calls.map((args) => args.join(" "));
    expect(messages.filter((m) => m.includes("getServerSnapshot"))).toEqual([]);
  });
});
