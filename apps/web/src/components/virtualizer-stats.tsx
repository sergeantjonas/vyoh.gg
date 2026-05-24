import { usePerfFlag } from "@/lib/use-perf-flag";

type Props = {
  rendered: number;
  total: number;
  // Optional lane count for grid-shaped virtualizers — emits an extra row
  // so the dev can sanity-check that the media-query-driven lane count
  // matches the visible breakpoint at the current viewport.
  lanes?: number;
};

// Floating dev overlay next to <PerfOverlay> (bottom-left, slightly
// right). Only mounts when the perf flag is on (?perf=1 or
// `vyoh:perf=1` in localStorage). Used by every virtualizer in the app
// so the windowed rendering can be eyeballed without instrumentation.
export function VirtualizerStats({ rendered, total, lanes }: Props) {
  const enabled = usePerfFlag();
  if (!enabled) return null;
  const saved = total === 0 ? "—" : `${Math.round(((total - rendered) / total) * 100)}%`;
  return (
    <div className="pointer-events-none fixed bottom-4 left-44 z-50 rounded-lg border border-border bg-background/85 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        virtualizer
      </div>
      <ul className="space-y-0.5">
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">rendered</span>
          <span className="text-emerald-400">{rendered}</span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">total</span>
          <span>{total}</span>
        </li>
        {lanes !== undefined && (
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">lanes</span>
            <span>{lanes}</span>
          </li>
        )}
        <li className="flex justify-between gap-3">
          <span className="text-muted-foreground">saved</span>
          <span className="text-amber-400">{saved}</span>
        </li>
      </ul>
    </div>
  );
}
