import { BackdropPortal } from "@/_shared/backdrop/backdrop-portal";
import { useAudio } from "@/lib/use-audio";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  DEFAULT_SERIOUS_QUEUE_IDS,
  SeriousQueuesProvider,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("renders nothing for a backdrop portal instead of throwing", () => {
    // `react-dom/server` cannot render a portal, so this has to opt out — but
    // via a hydration-aware flag, not `typeof document`, which would put the
    // client's first render on the other branch.
    expect(renderToString(<BackdropPortal>backdrop</BackdropPortal>)).toBe("");
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
