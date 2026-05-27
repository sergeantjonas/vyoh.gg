import type * as React from "react";

import { cn } from "@/lib/utils";

type HeroNumberSize = "lg" | "md";

function HeroNumber({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<"span"> & { size?: HeroNumberSize }) {
  return (
    <span
      data-slot="hero-number"
      data-size={size}
      className={cn(
        "block font-[720] leading-none tracking-[-0.02em] tabular-nums",
        size === "lg" && "text-[clamp(2.5rem,5vw,4rem)]",
        size === "md" && "text-[clamp(1.75rem,3vw,2.5rem)]",
        className
      )}
      {...props}
    />
  );
}

function HeroLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="hero-label"
      className={cn(
        "block font-[380] text-[11px] text-muted-foreground/80 uppercase leading-tight tracking-[0.18em]",
        className
      )}
      {...props}
    />
  );
}

function HeroPair({
  label,
  children,
  labelPosition = "above",
  size,
  className,
  labelClassName,
  valueClassName,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  labelPosition?: "above" | "below";
  size?: HeroNumberSize;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  const labelNode = <HeroLabel className={labelClassName}>{label}</HeroLabel>;
  const valueNode = (
    <HeroNumber {...(size ? { size } : {})} className={valueClassName}>
      {children}
    </HeroNumber>
  );
  return (
    <div
      data-slot="hero-pair"
      data-label-position={labelPosition}
      className={cn("flex flex-col gap-1", className)}
    >
      {labelPosition === "above" ? labelNode : valueNode}
      {labelPosition === "above" ? valueNode : labelNode}
    </div>
  );
}

export { HeroNumber, HeroLabel, HeroPair };
