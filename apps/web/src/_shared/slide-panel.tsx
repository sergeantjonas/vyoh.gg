import { cn } from "@/lib/utils";
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
   *  panel doesn't animate in on a direct deep-link visit. */
  skipSlideIn?: boolean | undefined;
  /** Optional header slot (share button, breadcrumb, etc.). The close button is
   *  rendered after the header content. */
  header?: ReactNode | undefined;
  children: ReactNode;
}

const ENTER_DURATION = 0.24;
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
  const animateIn = !skipSlideIn && !reduced;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Don't auto-focus the first focusable child — that would scroll the
          // panel content into view immediately. Header focusables (close,
          // share) are still keyboard-reachable.
          onOpenAutoFocus={(e) => e.preventDefault()}
          asChild
        >
          <m.div
            initial={animateIn ? { x: "100%" } : false}
            animate={{ x: 0 }}
            transition={{ duration: ENTER_DURATION, ease: EASE_OUT_QUART }}
            // Compositor-only slide. No filter / backdrop-filter — WebKit-safe.
            // Sits below the account header so global + section nav stay visible.
            className={cn(
              "fixed inset-x-0 z-40 flex flex-col overflow-y-auto bg-background",
              "top-[var(--account-header-h,0px)] bottom-0",
              "will-change-transform"
            )}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            <div className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b bg-background/95 px-4 py-2">
              {header}
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
