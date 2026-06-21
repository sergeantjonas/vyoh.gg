import { CountUp } from "@/components/count-up";
import { HeroLabel, HeroNumber } from "@/components/ui/hero-number";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useObjectiveParticipation } from "@/lol/profile/use-objective-participation";
import type { ObjectiveParticipationTally } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

// Enough games for a participation rate to mean something. Below this the strip
// renders nothing (the Profile carries no permanent empty zone).
const MIN_GAMES = 10;

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
};

function ObjectiveItem({
  label,
  tally,
}: {
  label: string;
  tally: ObjectiveParticipationTally;
}) {
  // Rate is takedowns over the team's kills of this objective, not over games —
  // a player can't participate in an objective the team never took.
  const rate =
    tally.teamKills > 0 ? Math.round((tally.takedowns / tally.teamKills) * 100) : 0;
  return (
    <m.div
      variants={item}
      className="flex flex-1 flex-col items-center gap-1.5 px-4 py-3"
    >
      <HeroLabel>{label}</HeroLabel>
      <HeroNumber size="md">
        <CountUp to={rate} />%
      </HeroNumber>
      <span className="text-[11px] text-muted-foreground/70">
        {tally.teamKills > 0 ? `${tally.takedowns} of ${tally.teamKills}` : "—"}
      </span>
    </m.div>
  );
}

export function ProfileObjectiveParticipation({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useObjectiveParticipation(account);

  if (isPending || !data || data.games < MIN_GAMES) return null;

  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex divide-x divide-border rounded-lg border bg-card/60 backdrop-blur-sm"
    >
      <ObjectiveItem label="Dragons" tally={data.dragons} />
      <ObjectiveItem label="Barons" tally={data.barons} />
      <ObjectiveItem label="Heralds" tally={data.heralds} />
    </m.div>
  );
}
