import { mainScrollRef } from "@/lib/scroll-container";
import {
  ScrollContainerProvider,
  registerOpenDetailPanel,
} from "@/lib/scroll-container-context";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

interface SlidePanelProps {
  open: boolean;
  /** Called when the user dismisses the panel (close button, ESC, outside click). */
  onClose: () => void;
  /** Accessible title for the dialog. Rendered sr-only by default. */
  title: string;
  /** Skip the entrance fade. Pass true for cold-arrival mounts so the
   *  panel doesn't animate in on a direct deep-link visit (per the arc:
   *  "the panel just *is*, in its open state"). */
  skipSlideIn?: boolean | undefined;
  /** Optional header slot — sub-tab nav, share button. Rendered before the
   *  close button in the panel header. */
  header?: ReactNode | undefined;
  /** Optional sticky secondary band rendered inside the same sticky wrapper
   *  as the panel header. Used by detail panels to lift the champion sticky
   *  strip up under the panel nav once the user scrolls past the hero. */
  stickyBelowHeader?: ReactNode | undefined;
  /** Receives the panel's scroll element once mounted. Detail panels use
   *  this to pass the scroll container into hooks (`useHeroScrolledPast`)
   *  that live in the panel's *parent* component — those hooks render
   *  outside the panel's ScrollContainerProvider and would otherwise fall
   *  back to <main>, which is scroll-locked while the panel is open. */
  onScrollElReady?: ((el: HTMLElement | null) => void) | undefined;
  children: ReactNode;
}

const ENTER_DURATION = 0.28;
const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

export function SlidePanel({
  open,
  onClose,
  title,
  skipSlideIn,
  header,
  stickyBelowHeader,
  onScrollElReady,
  children,
}: SlidePanelProps) {
  // Tracked so the scroll-container context can publish it to descendants
  // (useScrollspy switches from <main> to this element while the panel is
  // mounted). Also forwarded to the parent via onScrollElReady so hooks
  // called in the SlidePanel's parent (useHeroScrolledPast) can address the
  // panel's scroll surface directly — they live above the context provider
  // in render order so the context lookup wouldn't reach them.
  const [scrollEl, setScrollElState] = useState<HTMLElement | null>(null);
  const setScrollEl = (el: HTMLElement | null) => {
    setScrollElState(el);
    onScrollElReady?.(el);
  };
  const reduced = useReducedMotion();
  // Entrance: opacity fade only — NEVER a transform. Firefox (and to a
  // lesser extent WebKit) suppresses `backdrop-filter` painting while an
  // element is being transformed, which causes a jarring "pop" when the
  // blur snaps in only after the slide settles. A pure opacity transition
  // is a compositor-only effect that doesn't interfere with backdrop-filter,
  // so the frosted chrome is alive from frame 1. View Transitions still
  // own the row→hero morph on supporting browsers; rect-morph fallback
  // handles the hero entrance on the rest.
  const animateIn = !skipSlideIn && !reduced;

  // Lock main scroll while open. With modal={false} (so the global + section
  // nav stay clickable) Radix doesn't manage body scroll for us, but the
  // panel-as-focused-surface convention (Linear, GitHub PR drawer, Slack
  // thread pane) is to freeze the underlying page so the wheel/keyboard
  // scrolls the panel rather than the list peeking behind it. Restore on
  // close. Touch one element, not document.body — vyoh's scroll container
  // is <main>, not the document.
  useEffect(() => {
    if (!open) return;
    const el = mainScrollRef.current;
    if (!el) return;
    const previous = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = previous;
    };
  }, [open]);

  // Tell global overlays (ScrollToTop, etc.) that a panel is up so they can
  // hide — they sit at higher z than the panel and target main scroll which
  // we've just locked.
  useEffect(() => {
    if (!open) return;
    return registerOpenDetailPanel();
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      // modal={false} drops the focus trap + pointer-event lock on the rest
      // of the document. The global nav + section strip above the panel and
      // the list peeking out on the left stay clickable while the panel is
      // open. Radix still fires onEscapeKeyDown + onPointerDownOutside so ESC
      // and clicking the visible list close the panel via onOpenChange below.
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* No scrim. A scrim at z-30 sits over the SplashProvider backdrop
            (rendered at -z-10), so the panel's backdrop-blur only ever picked
            up the scrim's color — defeating the frosted effect entirely.
            Without the scrim, the panel's translucent + blurred chrome
            actually sees the splash + page content behind it, producing the
            real frosted-glass appearance. Focus is preserved by the panel's
            own lift (bg-card/65, border-l, shadow-2xl) plus the list-locked
            scroll, not by dimming the surrounding page. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Don't auto-focus the first focusable child — that would scroll the
          // panel content into view immediately. Header focusables (close,
          // share, tabs) are still keyboard-reachable.
          onOpenAutoFocus={(e) => e.preventDefault()}
          asChild
        >
          <m.div
            ref={setScrollEl}
            initial={animateIn ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: ENTER_DURATION, ease: EASE_OUT_QUART }}
            className={cn(
              // Right-aligned side panel constrained to the site content
              // column (max-w-4xl matches nav.tsx + __root). The list peeks
              // out on the left as ambient context; clicking it closes.
              "fixed top-[var(--account-header-h,0px)] bottom-0 right-0 z-40",
              "flex w-full max-w-4xl flex-col overflow-y-auto",
              // Frosted-glass chrome: heavily translucent so the splash
              // backdrop and match-card themes behind bleed through the
              // blur into the panel body, but tinted toward `bg-card` (one
              // tier lifted from `bg-background` in the theme tokens —
              // oklch 0.205 vs 0.145) so the panel still reads as a
              // distinct surface. backdrop-blur-2xl (40px) dissolves
              // recognisable content behind into a colored frost.
              // `isolation: isolate` keeps the blur composite stable
              // through child animations.
              "border-l border-white/10 bg-card/50 backdrop-blur-2xl shadow-2xl isolate"
            )}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {/* Wrap header + stickyBelowHeader in a single sticky container
                so the whole chrome moves together and the strip animates in
                without overlapping the tab nav. */}
            <div className="sticky top-0 z-10">
              <div
                data-panel-header=""
                className={cn(
                  // Header is slightly more opaque than the panel body so the
                  // tab labels stay crisp over busy content behind the blur.
                  "flex items-center gap-2 border-b border-white/10 bg-card/75 px-3 py-2 backdrop-blur-2xl sm:px-4 sm:gap-3",
                  // Narrow viewports: hide tab labels (SectionTabLink wraps
                  // them in [data-tab-label]) so four icon+label tabs + share
                  // + close still fit without horizontal scroll.
                  "[&_[data-tab-label]]:hidden md:[&_[data-tab-label]]:inline"
                )}
              >
                <div className="flex flex-1 items-center gap-1 overflow-x-auto">
                  {header}
                </div>
                <DialogPrimitive.Close
                  aria-label="Close panel"
                  className="cursor-pointer rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>
              </div>
              {stickyBelowHeader}
            </div>
            <ScrollContainerProvider el={scrollEl}>
              <div className="flex-1">{children}</div>
            </ScrollContainerProvider>
          </m.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
