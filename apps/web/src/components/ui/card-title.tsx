import type * as React from "react";

import { cn } from "@/lib/utils";

type CardTitleElement = "h2" | "h3" | "h4";

function CardTitle({
  as: Component = "h3",
  className,
  ...props
}: React.ComponentProps<"h3"> & { as?: CardTitleElement }) {
  return (
    <Component
      data-slot="card-title"
      className={cn(
        "font-medium text-sm uppercase leading-tight tracking-[0.2em] text-foreground/70",
        className
      )}
      {...props}
    />
  );
}

export { CardTitle };
