// "by FromSoftware Inc. · Published by Bandai Namco · Franchise: Elden Ring"
// — the editorial credits line for the game-detail header, rendered off the
// publisher/developer/franchise arrays captured in Chunk 6 (the same data
// powering the `dev:` / `pub:` / `franchise:` palette grammar). All three
// arrays are independently optional: render only the segments with at least
// one entry, skip the whole line when none are populated.
//
// Multi-entry arrays join with `, ` inside the segment, then segments join
// with the same `·` separator the existing header chip row uses (review
// chip, deck chip, rating badge) so the visual rhythm carries through.

interface CreditsLineProps {
  developers: string[];
  publishers: string[];
  franchises: string[];
}

export function CreditsLine({ developers, publishers, franchises }: CreditsLineProps) {
  const segments: { label: string; values: string[] }[] = [];
  if (developers.length > 0) segments.push({ label: "by", values: developers });
  if (publishers.length > 0) {
    segments.push({ label: "Published by", values: publishers });
  }
  if (franchises.length > 0) {
    segments.push({ label: "Franchise", values: franchises });
  }
  if (segments.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {segments.map((segment, i) => (
        <span key={segment.label}>
          {i > 0 && <span className="px-1.5 opacity-50">·</span>}
          <span className="opacity-75">{segment.label} </span>
          <span className="text-foreground/80">{segment.values.join(", ")}</span>
        </span>
      ))}
    </p>
  );
}
