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
  /** Optional image URL for the panel chrome backdrop. Rendered as the
   *  panel's background under a dark overlay so the panel reads as an
   *  atmospheric surface (same splash energy as the global nav) instead
   *  of flat bg-card. Detail panels pass the relevant champion / game
   *  splash; surfaces without a natural backdrop omit it. */
  chromeBackdropUrl?: string | null | undefined;
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
  chromeBackdropUrl,
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
  // Only the scrim animates on entrance — the panel chrome itself NEVER
  // animates opacity or transform. Both create a stacking context on the
  // panel, which suppresses `backdrop-filter` painting on EVERY descendant
  // for the duration of the animation. That's the "frosted cards are
  // transparent first, then suddenly blurred" pop the user saw in Firefox.
  // Cold deep-links + reduced-motion skip the scrim fade entirely.
  const animateScrim = !skipSlideIn && !reduced;

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
        {/* Non-blocking scrim — dims the page behind the panel so visual
            attention focuses on the panel content. pointer-events stay off
            so the visible list on the left + the section nav above stay
            clickable (modal={false} contract). Fades in with the panel. */}
        <m.div
          aria-hidden
          initial={animateScrim ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: ENTER_DURATION, ease: EASE_OUT_QUART }}
          className="pointer-events-none fixed inset-0 z-30 bg-black/45"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Don't auto-focus the first focusable child — that would scroll the
          // panel content into view immediately. Header focusables (close,
          // share, tabs) are still keyboard-reachable.
          onOpenAutoFocus={(e) => e.preventDefault()}
          asChild
        >
          <m.div
            // No initial/animate — panel chrome must never have opacity != 1
            // on first paint or descendants' backdrop-filter will fail to
            // render until the animation settles, producing the visible
            // "frosted pop-in". The scrim handles the entrance signal.
            initial={false}
            className={cn(
              // Right-aligned side panel constrained to the site content
              // column (max-w-4xl matches nav.tsx + __root). The list peeks
              // out on the left as ambient context; clicking it closes.
              "fixed top-[var(--account-header-h,0px)] bottom-0 right-0 z-40",
              "w-full max-w-4xl",
              // Solid bg-card base — earlier rounds tried bg-card/50 +
              // backdrop-blur-2xl for a frosted look but the cost was
              // uneven across engines (Firefox refused to paint backdrop-
              // filter on scroll containers; WebKit hitched on the blur
              // composite; even Chromium was marginal). When a
              // `chromeBackdropUrl` is supplied, that image is layered
              // under a dark gradient overlay below so the panel carries
              // the same splash atmosphere as the global nav — no live
              // backdrop-filter needed, the image is just baked into the
              // panel's static background.
              "border-l border-white/10 bg-card shadow-2xl"
            )}
            {...(chromeBackdropUrl
              ? {
                  style: {
                    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 40%, rgba(0,0,0,0.65) 100%), url(${chromeBackdropUrl})`,
                    backgroundSize: "cover, cover",
                    backgroundPosition: "center, center",
                    backgroundRepeat: "no-repeat, no-repeat",
                  },
                }
              : {})}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {/* Inner scroll surface — separate element so backdrop-filter
                on the outer chrome actually paints in Firefox. */}
            <div
              ref={setScrollEl}
              className="absolute inset-0 flex flex-col overflow-y-auto"
            >
              {/* Wrap header + stickyBelowHeader in a single sticky
                  container so the whole chrome moves together and the strip
                  animates in without overlapping the tab nav.
                  z-index must beat anything in the panel body that
                  introduces its own stacking context — MatchHero is `z-30`
                  for its rect-morph entrance, so a value above that is the
                  floor here. */}
              <div className="sticky top-0 z-40">
                <div
                  data-panel-header=""
                  className={cn(
                    "flex items-center gap-2 border-b border-white/10 bg-card px-3 py-2 sm:px-4 sm:gap-3",
                    // Narrow viewports: hide tab labels (SectionTabLink
                    // wraps them in [data-tab-label]) so four icon+label
                    // tabs + share + close still fit without horizontal
                    // scroll.
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
            </div>
          </m.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
