import { SectionTitle } from "@/components/ui/section-title";

interface BandHeaderProps {
  title: string;
  count: number;
  // Plural noun for the density chip; the singular is derived by stripping a
  // trailing "s". Defaults to "titles".
  unit?: string;
}

// Shared band divider: a SectionTitle-tier header carrying the density chip the
// art-direction note makes load-bearing ("Q4 2026 · 11 titles") — it keeps the
// crowding story visible even when the crowded quarter isn't inside the calendar
// window. Bands are bare sections (their capsule children carry the visual
// weight), so the header does the dividing — see § glass table.
export function BandHeader({ title, count, unit = "titles" }: BandHeaderProps) {
  const noun = count === 1 ? unit.replace(/s$/, "") : unit;
  return (
    <div className="flex items-baseline gap-2">
      <SectionTitle as="h3">{title}</SectionTitle>
      <span className="text-muted-foreground text-xs">
        · {count} {noun}
      </span>
    </div>
  );
}
