import { SlidePanel } from "@/_shared/slide-panel";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

// Diagnostic route mirroring the static /frost-test.html cases A-E but
// rendered via React + our Tailwind. If cases pop here that don't pop in
// the static page, the culprit is somewhere in React / Tailwind / Vite
// CSS injection / etc — NOT the backdrop-filter technique itself.
//
// Visit at /debug/frost in any browser. Click "Toggle" to unmount+remount
// B-E. Watch which cards pop (start transparent, then frosted) and which
// paint frosted from first frame.

export const Route = createFileRoute("/debug/frost")({
  component: FrostDiagnostic,
});

const BG_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.4)), url('http://localhost:2010/img/lol/champion/ahri/hd/16.11.1.webp')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  minHeight: "100vh",
};

function Frosted({ label }: { label: string }) {
  return (
    <div className="flex min-h-[70px] items-center justify-center rounded-md border bg-card/60 p-4 text-sm font-medium backdrop-blur-sm">
      {label}
    </div>
  );
}

const SPLASH_URL = "http://localhost:2010/img/lol/champion/ahri/hd/16.11.1.webp";

// Mimics the body wrapper in $matchId.tsx — false initially, true after
// MORPH_SETTLE_MS (700ms). When it flips, skeleton unmounts and real content
// mounts. THIS is what the actual match panel does on Firefox (which
// returns false from supportsViewTransitions()).
function useDelayedReady(delayMs: number) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  return ready;
}

function FrostDiagnostic() {
  const [mounted, setMounted] = useState(true);
  const [radixOpen, setRadixOpen] = useState(false);
  const [slidePanelOpen, setSlidePanelOpen] = useState(false);
  const [swapPanelOpen, setSwapPanelOpen] = useState(false);

  return (
    <div style={BG_STYLE} className="p-6 text-white">
      {/* Case G mirror — same fixed frosted band as /debug/frost-b. Watch
          this during the link click below: if VT is the culprit, this band
          loses its blur briefly when the route changes. */}
      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-card/60 px-6 py-3 backdrop-blur-md">
        <span className="text-sm font-medium">
          G — fixed always-mounted frosted band (mirrors top nav shape)
        </span>
      </div>

      <div className="mt-16 mb-6">
        <Link
          to="/debug/frost-b"
          className="inline-block cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          → Navigate to /debug/frost-b (triggers VT — watch the band above)
        </Link>
      </div>

      <h1 className="mb-2 text-lg font-semibold">React-route frosted-glass diagnostic</h1>
      <p className="mb-4 text-sm opacity-80">
        Same cases as /frost-test.html but rendered via React + our Tailwind. If pops
        appear here that didn't appear in the static page, the issue is in our stack
        (React Strict Mode, Vite CSS injection, Tailwind, etc.) — not the underlying CSS.
      </p>
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMounted((m) => !m)}
          className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          Toggle B–E (un-mount → re-mount)
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          Hard reload
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider opacity-70">
            A — always-mounted React component
          </div>
          <Frosted label="A: always-mounted (React)" />
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider opacity-70">
            B — toggle-mounted React component
          </div>
          <div className="min-h-[100px] rounded-md border border-dashed border-white/30 p-2">
            {mounted && <Frosted label="B: just-mounted (React)" />}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider opacity-70">
            C — toggle-mounted with motion-style update
          </div>
          <div className="min-h-[100px] rounded-md border border-dashed border-white/30 p-2">
            {mounted && (
              <div
                // Mimics what Motion sets on a `m.div` even at rest
                style={{ willChange: "transform", transform: "translateZ(0)" }}
                className="flex min-h-[70px] items-center justify-center rounded-md border bg-card/60 p-4 text-sm font-medium backdrop-blur-sm"
              >
                C: just-mounted + will-change/transform
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider opacity-70">
            D — frosted card inside a raw Radix Dialog (no SlidePanel)
          </div>
          <button
            type="button"
            onClick={() => setRadixOpen((v) => !v)}
            className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          >
            {radixOpen ? "Close" : "Open"} D (Radix Dialog)
          </button>
          <DialogPrimitive.Root
            open={radixOpen}
            modal={false}
            onOpenChange={setRadixOpen}
          >
            <DialogPrimitive.Portal>
              <DialogPrimitive.Content
                aria-describedby={undefined}
                onOpenAutoFocus={(e) => e.preventDefault()}
                className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/20 bg-black/70 p-4"
              >
                <DialogPrimitive.Title className="mb-3 text-sm font-medium">
                  Radix Dialog
                </DialogPrimitive.Title>
                <Frosted label="D: frosted card inside Radix" />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider opacity-70">
            E — frosted card inside our actual SlidePanel (with chromeBackdropUrl)
          </div>
          <button
            type="button"
            onClick={() => setSlidePanelOpen((v) => !v)}
            className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          >
            {slidePanelOpen ? "Close" : "Open"} E (SlidePanel)
          </button>
          <SlidePanel
            open={slidePanelOpen}
            onClose={() => setSlidePanelOpen(false)}
            title="Frost diagnostic"
            chromeBackdropUrl={SPLASH_URL}
            header={<span className="text-sm">E header</span>}
          >
            <div className="flex flex-col gap-3 p-4">
              <Frosted label="E.1: frosted inside SlidePanel" />
              <Frosted label="E.2: another frosted inside SlidePanel" />
              <Frosted label="E.3: and a third" />
            </div>
          </SlidePanel>
        </div>

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider opacity-70">
            F — SlidePanel that swaps SKELETON → real content at t=700ms (matches the
            bodyReady gate in $matchId.tsx)
          </div>
          <button
            type="button"
            onClick={() => setSwapPanelOpen((v) => !v)}
            className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          >
            {swapPanelOpen ? "Close" : "Open"} F (mount-swap)
          </button>
          {swapPanelOpen && (
            <SlidePanel
              open
              onClose={() => setSwapPanelOpen(false)}
              title="Frost diagnostic (mount-swap)"
              chromeBackdropUrl={SPLASH_URL}
              header={<span className="text-sm">F header</span>}
            >
              <SwapBody />
            </SlidePanel>
          )}
        </div>
      </div>
    </div>
  );
}

function SwapBody() {
  const ready = useDelayedReady(700);
  return (
    <div className="flex flex-col gap-3 p-4">
      {!ready ? (
        <>
          <Frosted label="F.1: SKELETON (replaces at t=700ms)" />
          <Frosted label="F.2: SKELETON (replaces at t=700ms)" />
        </>
      ) : (
        <>
          <Frosted label="F.1: REAL content (just mounted at t=700ms)" />
          <Frosted label="F.2: REAL content (just mounted at t=700ms)" />
          <Frosted label="F.3: REAL content (just mounted at t=700ms)" />
        </>
      )}
    </div>
  );
}
