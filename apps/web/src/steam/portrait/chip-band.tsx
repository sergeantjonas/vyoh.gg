import { CardDensityProvider } from "@/components/card-density";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// The supporting facts under each hero band. Rows, not columns: CSS multi-column
// packs by height, which fills the band but scatters it — one column ends up
// carrying two cards while its neighbours stop early, leaving voids mid-band
// with nothing to read past them.
//
// The grid's default stretch is deliberate too. These claims run from one line
// to six, and letting each card end where its text does leaves gaps between the
// cards that read as broken layout; a row of equal rectangles reads as a row.
// The slack goes inside the border, where the compact density keeps it below
// the last line rather than in the middle of the card.
// Column count is the caller's call because it follows the card count: four
// chips across three columns strand one on a row of its own with two empty
// cells beside it, where four across two fill both rows exactly.
const COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  // Exactly three cards, which the two-column step would strand one of for the
  // whole md–xl range. Three-up from `md` costs 225 px columns at that
  // breakpoint against the 275 px every other band settles at — measured, that
  // is 37 px of extra card height and 223 px less band, because the alternative
  // is three full-width cards carrying a chip's worth of text each.
  "3-up": "md:grid-cols-3",
} as const;

export function ChipBand({
  columns = 3,
  children,
}: {
  columns?: keyof typeof COLUMNS;
  children: ReactNode;
}) {
  return (
    <CardDensityProvider value="compact">
      <div className={cn("grid grid-cols-1 gap-3", COLUMNS[columns])}>{children}</div>
    </CardDensityProvider>
  );
}
