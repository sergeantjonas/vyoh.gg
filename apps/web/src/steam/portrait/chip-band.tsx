import { CardDensityProvider } from "@/components/card-density";
import type { ReactNode } from "react";

// The supporting facts under each hero band: independent one-line claims of
// wildly different length, which is why they flow in columns rather than a
// grid. A grid aligns them into rows, so a four-card band leaves one card
// alone beside two empty cells, and every row is as tall as its longest card.
// Columns pack by height instead, and the ragged bottom edge is the point.
export function ChipBand({ children }: { children: ReactNode }) {
  return (
    <CardDensityProvider value="compact">
      <div className="columns-1 gap-3 md:columns-2 xl:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
        {children}
      </div>
    </CardDensityProvider>
  );
}
