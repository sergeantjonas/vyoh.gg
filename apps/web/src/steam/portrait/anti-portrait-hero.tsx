import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
  SECTION_CHILD_WILL_CHANGE,
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import type { SteamPortrait } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useSteamPortrait } from "./use-portrait";

const EYEBROW = "The gap";

// The Anti-Portrait's opening statement, and the page's sharpest number: the
// shelf collapses from owned to played to finished, and the funnel below draws
// the collapse rather than asking the reader to hold three counts in their head.
export function AntiPortraitHero() {
  const { data, isPending, isError } = useSteamPortrait();
  const reducedMotion = useReducedMotion();
  const steps = data === undefined ? [] : funnelSteps(data);

  return (
    <m.div
      className="flex flex-col gap-5"
      variants={
        reducedMotion ? sectionReducedContainerVariants : sectionContainerVariants
      }
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <m.span
          variants={sectionChildVariants.eyebrow}
          style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
          className="font-medium text-[10px] text-muted-foreground/70 uppercase tracking-[0.3em]"
        >
          {EYEBROW}
        </m.span>
        <EditorialHeading
          delegated
          as="h3"
          magnitude="medium"
          className="font-[680] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] -tracking-[0.02em]"
        >
          {headlineFor(data, { isPending, isError })}
        </EditorialHeading>
      </div>

      <m.p
        variants={sectionChildVariants.body}
        style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
        className="max-w-prose text-pretty text-foreground/80 text-sm leading-relaxed sm:text-base"
      >
        {data === undefined || data.posture.ownedCount === 0
          ? proseFor({ isPending, isError })
          : `You own ${data.posture.ownedCount} games, meaningfully played ${data.posture.meaningfulCount}, finished ${data.completion.finishedCount}. The gap is the hobby.`}
      </m.p>

      {steps.length > 0 && data !== undefined && (
        <m.div
          variants={sectionChildVariants.meta}
          style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
          className="flex flex-col gap-3"
        >
          <ul className="flex flex-col gap-2">
            {steps.map((step) => (
              <FunnelRow key={step.label} step={step} />
            ))}
          </ul>
          {/* "Finished" is the narrowest word on the page, so it says which
              games it was allowed to count rather than implying 18 of 186. */}
          <p className="text-muted-foreground/70 text-xs">
            Finished means past 80% of the achievements, counted over the{" "}
            {data.completion.cohortCount} games with a schema and ten hours in them.
          </p>
        </m.div>
      )}
    </m.div>
  );
}

interface FunnelStep {
  label: string;
  count: number;
  share: number;
}

// Every step is a share of the same denominator — the owned library — so the
// bars shorten against one another instead of each re-basing on its parent.
function funnelSteps(data: SteamPortrait): FunnelStep[] {
  const owned = data.posture.ownedCount;
  if (owned === 0) return [];
  const step = (label: string, count: number): FunnelStep => ({
    label,
    count,
    share: count / owned,
  });
  return [
    step("Owned", owned),
    step("Played past an hour", data.posture.meaningfulCount),
    step("Finished", data.completion.finishedCount),
  ];
}

function headlineFor(
  data: SteamPortrait | undefined,
  { isPending, isError }: { isPending: boolean; isError: boolean }
): string {
  if (isPending) return "Counting the shelf";
  if (isError || data === undefined) return "Unavailable";
  if (data.posture.ownedCount === 0) return "Nothing owned yet";
  if (data.posture.ghostCount === 0) return "Everything opened";
  return `${data.posture.ghostCount} never opened`;
}

function proseFor({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return "Adding up what was bought against what was played…";
  if (isError) return "The verdict is unavailable right now.";
  return "Nothing to add up until the library syncs.";
}

function FunnelRow({ step }: { step: FunnelStep }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-foreground/80 sm:w-44">
        {step.label}
      </span>
      <span
        aria-hidden="true"
        className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-foreground/10"
      >
        <span
          className="block h-full rounded-full bg-foreground/40"
          style={{ width: `${Math.max(step.share * 100, 1)}%` }}
        />
      </span>
      <span className="w-28 shrink-0 text-right text-muted-foreground/80 text-xs tabular-nums">
        {step.count} · {Math.round(step.share * 100)}%
      </span>
    </li>
  );
}
