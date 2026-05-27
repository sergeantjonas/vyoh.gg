import type * as React from "react";

import { cn } from "@/lib/utils";

type SectionTitleElement = "h2" | "h3" | "h4";

function SectionTitle({
  as: Component = "h3",
  className,
  ...props
}: React.ComponentProps<"h3"> & { as?: SectionTitleElement }) {
  return (
    <Component
      data-slot="section-title"
      className={cn(
        "font-semibold text-sm uppercase leading-tight tracking-[0.2em] text-foreground",
        className
      )}
      {...props}
    />
  );
}

export { SectionTitle };
