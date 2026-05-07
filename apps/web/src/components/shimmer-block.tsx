import { cn } from "@/lib/utils";

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-muted/40", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
