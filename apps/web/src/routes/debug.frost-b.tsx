import { Link, createFileRoute } from "@tanstack/react-router";

// Twin of /debug/frost — same fixed frosted element at the top, just a
// different route. Linking back and forth between /debug/frost and
// /debug/frost-b forces a router navigation that TanStack Router runs
// through `defaultViewTransition` (main.tsx). If the fixed frosted element
// flickers during the nav, we've confirmed VT snapshots aren't capturing
// `backdrop-filter` cleanly in Firefox.

export const Route = createFileRoute("/debug/frost-b")({
  component: FrostB,
});

const BG_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.4)), url('http://localhost:2010/img/lol/champion/ahri/hd/16.11.1.webp')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  minHeight: "100vh",
};

function FrostB() {
  return (
    <div style={BG_STYLE} className="p-6 text-white">
      {/* The candidate flicker target — a fixed, always-mounted frosted
          element shaped like the top nav (sticky/fixed + backdrop-blur). */}
      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-card/60 px-6 py-3 backdrop-blur-md">
        <span className="text-sm font-medium">
          G — fixed always-mounted frosted band (mirrors top nav shape)
        </span>
      </div>

      <div className="mt-20 max-w-2xl space-y-4">
        <h1 className="text-lg font-semibold">Case G — VT navigation flicker test</h1>
        <p className="text-sm opacity-80">
          The bar at the top of this page has the SAME styling as our actual top navbar: a
          fixed, always-mounted element with <code>bg-card/60 backdrop-blur-md</code>. It
          is never unmounted, never re-mounted. If you click the link below and watch the
          bar carefully, and the backdrop-blur briefly disappears mid-navigation then
          comes back — that's the router's <code>defaultViewTransition</code> rasterising
          the page into OLD/NEW snapshots, and Firefox not capturing the backdrop-filter
          into those snapshots.
        </p>
        <Link
          to="/debug/frost"
          className="inline-block cursor-pointer rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          → Navigate to /debug/frost (triggers VT)
        </Link>
      </div>
    </div>
  );
}
