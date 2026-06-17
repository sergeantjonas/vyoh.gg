import { CountUp } from "@/components/count-up";
import { HeroLabel, HeroNumber } from "@/components/ui/hero-number";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useObjectiveFirsts } from "@/lol/profile/use-objective-firsts";
import type { ObjectiveFirstTally } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

// Enough games for an early-objective rate to mean something. Below this the
// strip renders nothing (the Profile carries no permanent empty zone).
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
  games,
}: {
  label: string;
  tally: ObjectiveFirstTally;
  games: number;
}) {
  const rate = games > 0 ? Math.round((tally.count / games) * 100) : 0;
  const winWhen = tally.count > 0 ? Math.round((tally.wins / tally.count) * 100) : 0;
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
        {tally.count > 0 ? `${winWhen}% win when you do` : "—"}
      </span>
    </m.div>
  );
}

export function ProfileObjectiveFirsts({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useObjectiveFirsts(account);

  if (isPending || !data || data.games < MIN_GAMES) return null;

  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex divide-x divide-border rounded-lg border bg-card/60 backdrop-blur-sm"
    >
      <ObjectiveItem label="First Blood" tally={data.firstBlood} games={data.games} />
      <ObjectiveItem label="First Tower" tally={data.firstTower} games={data.games} />
    </m.div>
  );
}
