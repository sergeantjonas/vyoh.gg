import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
  SECTION_CHILD_WILL_CHANGE,
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import type { SteamPortrait } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { StatRow } from "./stat-row";
import { useSteamPortrait } from "./use-portrait";

// The Anti-Portrait's opening statement, and the page's sharpest number: the
// shelf collapses from owned to played to finished, and the funnel below draws
// the collapse rather than asking the reader to hold three counts in their head.
// No eyebrow, for the reason its twin in portrait-hero.tsx spells out.
export function AntiPortraitHero() {
  const { data, isPending, isError } = useSteamPortrait();
  const reducedMotion = useReducedMotion();
  const steps = data === undefined ? [] : funnelSteps(data);

  return (
    <m.div
      className="flex flex-col gap-4"
      variants={
        reducedMotion ? sectionReducedContainerVariants : sectionContainerVariants
      }
      initial="hidden"
      animate="visible"
    >
      <EditorialHeading
        delegated
        as="h3"
        magnitude="medium"
        className="font-[680] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] -tracking-[0.02em]"
      >
        {headlineFor(data, { isPending, isError })}
      </EditorialHeading>

      <m.p
        variants={sectionChildVariants.body}
        style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
        className="text-pretty text-foreground/80 text-base leading-relaxed sm:text-lg"
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
              <FunnelRow key={step.label} step={step} owned={data.posture.ownedCount} />
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

function FunnelRow({ step, owned }: { step: FunnelStep; owned: number }) {
  return (
    <StatRow
      label={step.label}
      fill={step.share}
      trailing={`${step.count} · ${Math.round(step.share * 100)}%`}
      tooltip={
        <>
          <p className="font-medium text-foreground">{step.label}</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {step.count} of the {owned} games you own — {owned - step.count} did not get
            this far.
          </p>
        </>
      }
    />
  );
}
