// "by FromSoftware · Published by Bandai Namco · Franchise: Elden Ring" —
// the editorial credits line for the game-detail header, rendered off the
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

// Trim publisher-name corporate suffixes that add noise without information.
// Steam returns the legal entity name (`FromSoftware, Inc.`, `Capcom Co., Ltd.`,
// `Bandai Namco Entertainment, LLC`); the credits line is editorial, not a
// legal filing, so the short form reads better. Order matters — `, Inc.`
// has to strip before a bare `Inc.` match would touch nothing.
const CORPORATE_SUFFIX_RE =
  /(,?\s*(?:Inc\.?|Ltd\.?|LLC|Limited|GmbH|Co\.,?\s*Ltd\.?|Corporation|Corp\.?|Entertainment|Games|Studios?|Interactive))+\s*$/i;

function tidyEntityName(name: string): string {
  return name.replace(CORPORATE_SUFFIX_RE, "").trim() || name;
}

// Drop duplicates AFTER tidying — a publisher list that already names the
// same entity as the developer ("by FromSoftware · Published by FromSoftware")
// is pure noise. Compare on the tidied form so `FromSoftware, Inc.` and
// `FromSoftware` collapse together. Preserves first-occurrence order.
function dedupeAgainst(values: string[], avoid: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const tidied = tidyEntityName(v);
    const key = tidied.toLowerCase();
    if (avoid.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(tidied);
  }
  return out;
}

function tidyList(values: string[]): string[] {
  return dedupeAgainst(values, new Set());
}

export function CreditsLine({ developers, publishers, franchises }: CreditsLineProps) {
  const tidyDevs = tidyList(developers);
  // Publishers that are already in the developer list become dead weight —
  // the typical self-published case ("FromSoftware made it, FromSoftware
  // published it") shouldn't render twice.
  const devKeys = new Set(tidyDevs.map((d) => d.toLowerCase()));
  const tidyPubs = dedupeAgainst(publishers, devKeys);
  const tidyFranchises = tidyList(franchises);

  const segments: { label: string; values: string[] }[] = [];
  if (tidyDevs.length > 0) segments.push({ label: "by", values: tidyDevs });
  if (tidyPubs.length > 0) {
    segments.push({ label: "Published by", values: tidyPubs });
  }
  if (tidyFranchises.length > 0) {
    segments.push({ label: "Franchise", values: tidyFranchises });
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
