import { CountUp } from "@/components/count-up";
import { HeroLabel, HeroNumber } from "@/components/ui/hero-number";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useCarryProfile } from "@/lol/profile/use-carry-profile";
import type { CarryProfileSplit } from "@vyoh/shared";
import { m } from "motion/react";

// Enough games for both damage tiers to carry a meaningful win rate.
const MIN_GAMES = 10;

const wrPct = (s: CarryProfileSplit) =>
  s.games > 0 ? Math.round((s.wins / s.games) * 100) : null;

function TierItem({ label, split }: { label: string; split: CarryProfileSplit }) {
  const wr = wrPct(split);
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 px-4 py-3">
      <HeroLabel>{label}</HeroLabel>
      <HeroNumber size="md">
        {wr === null ? (
          "—"
        ) : (
          <>
            <CountUp to={wr} />%
          </>
        )}
      </HeroNumber>
      <span className="text-[11px] text-muted-foreground/70">
        {split.games} {split.games === 1 ? "game" : "games"}
      </span>
    </div>
  );
}

export function ProfileCarryProfile({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useCarryProfile(account);

  if (isPending || !data || data.games < MIN_GAMES) return null;

  const topWr = wrPct(data.topThree);
  const bottomWr = wrPct(data.bottomTwo);

  let verdict: string;
  if (topWr !== null && bottomWr !== null) {
    verdict = `You win ${topWr}% of games when you're top-3 in your team's damage, and ${bottomWr}% when you're not.`;
  } else if (bottomWr === null) {
    verdict = `You're top-3 in your team's damage in every one of these ${data.games} games — a steady damage load.`;
  } else {
    verdict = `You're rarely your team's top damage dealer — and still win ${bottomWr}% of those games.`;
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="flex flex-col gap-3 rounded-lg border bg-card/60 p-4 backdrop-blur-sm"
    >
      <p className="text-sm text-muted-foreground">{verdict}</p>
      <div className="flex divide-x divide-border">
        <TierItem label="Top-3 Damage" split={data.topThree} />
        <TierItem label="Bottom-2 Damage" split={data.bottomTwo} />
      </div>
    </m.div>
  );
}
