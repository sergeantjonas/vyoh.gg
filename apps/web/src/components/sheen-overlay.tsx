// Steam-style anchored sheen: a 210° gradient whose bright stop stays pinned
// at the top-right corner while the transparent end-stop extends inward on
// hover, so the gloss reads as growing from the corner rather than a band
// sliding across the art. The falloff animates through the registered
// `--sheen-extent` property in index.css; `data-sheen` is the hook the
// reduced-motion block there uses to pin the extent and drop the transition.
//
// Sits on a `relative overflow-hidden` parent that also carries the matching
// `group/<name>` class — the hover variant reads that named group, and
// Tailwind only emits a variant it can find spelled out literally somewhere
// in the file, which is why the two flavours are written out rather than
// built from the group name.
const RECIPE =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.12)_calc(var(--sheen-extent)-6%),rgba(255,255,255,0)_var(--sheen-extent))] opacity-20 transition-[--sheen-extent,opacity] duration-900 ease-out [--sheen-extent:25%]";

const BY_GROUP = {
  tile: `${RECIPE} group-hover/tile:opacity-100 group-hover/tile:[--sheen-extent:42%]`,
  row: `${RECIPE} group-hover/row:opacity-100 group-hover/row:[--sheen-extent:42%]`,
} as const;

export type SheenGroup = keyof typeof BY_GROUP;

export function SheenOverlay({ group }: { group: SheenGroup }) {
  return <div aria-hidden data-sheen className={BY_GROUP[group]} />;
}
