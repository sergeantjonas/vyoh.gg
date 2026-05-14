import { CardShell, type CardShellProps } from "@/components/card-shell";

// Sibling to ConclusionCard, same shell, different indicator semantics.
// Steam library/catalog facts (wishlist length, owned-game count, "ever
// launched" count) are not statistical samples — they're the full population.
// Treating them with the LoL trends' sample-size confidence badge produced
// false signal (e.g. a 21-game wishlist rendered "Moderate sample"). FactCard
// renders a plain count instead, with the unit as the affordance.
export interface FactCardProps extends Omit<CardShellProps, "indicator"> {
  /** Numeric metric shown in the top-right. Omit for cards that have no count to show. */
  metric?: number;
  /** Singular/plural unit label. Singular used when metric === 1. */
  metricLabel?: { singular: string; plural: string };
}

export function FactCard({ metric, metricLabel, ...rest }: FactCardProps) {
  return (
    <CardShell
      {...rest}
      indicator={
        metric !== undefined && metricLabel !== undefined ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground/60">
            <span
              aria-hidden="true"
              className="h-1 w-1 rounded-full bg-current opacity-60"
            />
            <span>
              {metric} {metric === 1 ? metricLabel.singular : metricLabel.plural}
            </span>
          </span>
        ) : undefined
      }
    />
  );
}
