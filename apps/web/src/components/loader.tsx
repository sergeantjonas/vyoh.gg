import { cn } from "@/lib/utils";

export function Loader({
  size = 18,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <output aria-label={label} className="inline-flex">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn("animate-spin text-muted-foreground", className)}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth="2.5"
        />
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="14 40"
        />
      </svg>
    </output>
  );
}
