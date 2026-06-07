import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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

function FrostDiagnostic() {
  const [mounted, setMounted] = useState(true);

  return (
    <div style={BG_STYLE} className="p-6 text-white">
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
      </div>
    </div>
  );
}
