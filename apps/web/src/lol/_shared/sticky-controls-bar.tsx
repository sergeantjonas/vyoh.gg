import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Full-bleed frosted-glass bar that sticks below the account header. Use on
 * long-list pages (Matches, Champions) so per-view controls remain reachable
 * without scrolling back to top.
 *
 * Anchors via the `--account-header-h` CSS variable that the layout's
 * ResizeObserver writes — the bar follows when the header compacts/expands.
 * Background uses the same translucent + backdrop-blur pattern as the
 * account header so content scrolling underneath stays legible-but-muted.
 */
export function StickyControlsBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="sticky z-30 ml-[calc(50%-50vw)] w-screen bg-background/70 backdrop-blur-md"
      style={{ top: "var(--account-header-h, 0px)" }}
    >
      <div
        className={cn("mx-auto flex max-w-4xl items-center gap-3 px-6 py-2", className)}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
      />
    </div>
  );
}
