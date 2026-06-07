import { cn } from "@/lib/utils";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface SlidePanelProps {
  open: boolean;
  /** Called when the user dismisses the panel (close button, ESC, outside click). */
  onClose: () => void;
  /** Accessible title for the dialog. Rendered sr-only by default. */
  title: string;
  /** Skip the slide-in animation. Pass true for cold-arrival mounts so the
   *  panel doesn't animate in on a direct deep-link visit (per the arc:
   *  "the panel just *is*, in its open state"). */
  skipSlideIn?: boolean | undefined;
  /** Optional header slot — sub-tab nav, share button, breadcrumb. Rendered
   *  before the close button in the panel header. */
  header?: ReactNode | undefined;
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
  children,
}: SlidePanelProps) {
  const reduced = useReducedMotion();
  // View Transitions cross-fade the panel chrome automatically as part of the
  // row→hero morph snapshot. Running our own translateX slide-in on top puts
  // the panel offscreen at NEW-snapshot capture time, which makes VT pair the
  // row with the hero's *offscreen-right* position — the morph appears to
  // fly off-screen. Skip the slide whenever VT is taking over the entrance;
  // we only run the Motion slide on the rect-morph fallback path (Safari).
  const animateIn = !skipSlideIn && !reduced && !supportsViewTransitions();

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
        {/* Non-blocking scrim — focuses attention on the panel without
            stealing pointer events from the list peeking out on the left
            (the click-on-list-to-close behavior depends on the list staying
            interactive). The scrim sits below the panel content. */}
        <m.div
          aria-hidden
          initial={animateIn ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: ENTER_DURATION, ease: EASE_OUT_QUART }}
          className="pointer-events-none fixed inset-0 z-30 bg-background/30 backdrop-brightness-75"
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
            initial={animateIn ? { x: "100%" } : false}
            animate={{ x: 0 }}
            transition={{ duration: ENTER_DURATION, ease: EASE_OUT_QUART }}
            className={cn(
              // Right-aligned side panel constrained to the site content
              // column (max-w-4xl matches nav.tsx + __root). The list peeks
              // out on the left as ambient context; clicking it closes.
              "fixed top-[var(--account-header-h,0px)] bottom-0 right-0 z-40",
              "flex w-full max-w-4xl flex-col overflow-y-auto",
              // Frosted chrome — opaque black read as a dead window cut into
              // the page; a translucent + blurred background reads as a panel
              // floating over the list, which is what it is.
              "border-l border-border/60 bg-background/85 backdrop-blur-xl shadow-2xl",
              // Compositor-only transform — WebKit-safe (no filter / backdrop
              // on the *transformed* element; backdrop-blur is fine here
              // because the element is also the slide subject only on the
              // non-VT path — Safari).
              "will-change-transform"
            )}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-md">
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
            <div className="flex-1">{children}</div>
          </m.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
