const ANIMATION =
  "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

const SHELL =
  "pointer-events-none z-50 rounded-md border bg-popover/85 text-popover-foreground shadow-xl backdrop-blur-md";

export const TOOLTIP_CONTENT_COMPACT = `${SHELL} px-2 py-1 text-xs ${ANIMATION}`;

export const TOOLTIP_CONTENT_RICH = `${SHELL} w-max max-w-48 p-3 ${ANIMATION}`;
