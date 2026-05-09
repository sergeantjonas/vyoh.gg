const R = 5;
const C = +(2 * Math.PI * R).toFixed(2); // 31.42
const HALF_C = +(Math.PI * R).toFixed(2); // 15.71

const TITLE: Record<"empty" | "partial" | "full", string> = {
  empty: "Small sample — directional only",
  partial: "Moderate sample",
  full: "Confident estimate",
};

export function SampleSizeBadge({ count }: { count: number }) {
  const level: "empty" | "partial" | "full" =
    count < 10 ? "empty" : count < 30 ? "partial" : "full";
  const dashLen = level === "empty" ? 0 : level === "partial" ? HALF_C : C;
  const gap = +(C - dashLen).toFixed(2);

  return (
    <span
      className="flex shrink-0 items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground/60"
      title={TITLE[level]}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {/* track */}
        <circle
          cx="7"
          cy="7"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.25"
        />
        {/* fill arc */}
        {level !== "empty" && (
          <circle
            cx="7"
            cy="7"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={`${dashLen} ${gap}`}
            strokeLinecap="round"
            transform="rotate(-90 7 7)"
          />
        )}
      </svg>
      <span>
        {count} {count === 1 ? "game" : "games"}
      </span>
    </span>
  );
}
