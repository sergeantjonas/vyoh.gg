import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { type KeyboardEvent, useRef } from "react";

// The two wishlist views. `Upcoming` is the editorial upcoming-releases surface
// (calendar + bands, built in chunk 3); `All` is the full row list. The tab is a
// URL search param (`?tab=`) rather than a sub-route so the path stays
// `/steam/wishlist` — keeping the section-root scroll-reset + back-restore wiring
// in routes/steam.tsx unchanged, and letting the ⌘K palette deep-link to a view
// by emitting the search param (chunk 6).
export const WISHLIST_TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
] as const;

export type WishlistTab = (typeof WISHLIST_TABS)[number]["id"];

export function isWishlistTab(value: unknown): value is WishlistTab {
  return value === "upcoming" || value === "all";
}

export function wishlistTabId(tab: WishlistTab): string {
  return `wishlist-tab-${tab}`;
}

export function wishlistPanelId(tab: WishlistTab): string {
  return `wishlist-panel-${tab}`;
}

interface WishlistTabsProps {
  active: WishlistTab;
}

export function WishlistTabs({ active }: WishlistTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Manual-activation tablist (WAI-ARIA APG): arrow keys move focus between
  // tabs; Enter/click navigates. Automatic activation would fire a route change
  // on every arrow keypress, which is jarring for a URL-backed tab. Focus roves
  // relative to the *currently focused* tab (not the selected one), so arrowing
  // off a non-selected tab behaves correctly.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []
    );
    if (tabs.length === 0) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const focused = tabs.indexOf(document.activeElement as HTMLElement);
    const from =
      focused === -1 ? WISHLIST_TABS.findIndex((tab) => tab.id === active) : focused;
    tabs[(from + delta + tabs.length) % tabs.length]?.focus();
    event.preventDefault();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Wishlist views"
      onKeyDown={onKeyDown}
      className="inline-flex w-fit rounded-lg border border-border bg-card/50 p-1 backdrop-blur-sm"
    >
      {WISHLIST_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            id={wishlistTabId(tab.id)}
            to="/steam/wishlist"
            search={(prev) => ({ ...prev, tab: tab.id })}
            role="tab"
            aria-selected={selected}
            aria-controls={wishlistPanelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium tracking-wide outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
