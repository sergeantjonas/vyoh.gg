import { CountUp } from "@/components/count-up";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useNarrativeLifetime } from "@/lol/profile/use-narrative-lifetime";
import { type Variants, m } from "motion/react";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
};

function StatItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <m.div
      variants={item}
      className="flex flex-1 flex-col items-center gap-0.5 px-4 py-3"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{children}</div>
    </m.div>
  );
}

/**
 * Lifetime multikill milestone strip. Sibling of ProfileStatsBar — same visual
 * rhythm, different aggregate (lifetime, not window) and different source (the
 * narrative endpoint, which reads detail-cache JSON rather than the lean
 * MatchSummary row). Suppressed entirely when nothing of note has happened.
 */
export function ProfileMultikillStrip({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useNarrativeLifetime(account);

  if (isPending || !data) return null;
  const { multikills } = data;
  const total =
    multikills.pentaKills +
    multikills.quadraKills +
    multikills.tripleKills +
    multikills.doubleKills;
  if (total === 0) return null;

  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex divide-x divide-border rounded-lg border bg-card/50"
    >
      <StatItem label="Pentas">
        <CountUp to={multikills.pentaKills} />
      </StatItem>
      <StatItem label="Quadras">
        <CountUp to={multikills.quadraKills} />
      </StatItem>
      <StatItem label="Triples">
        <CountUp to={multikills.tripleKills} />
      </StatItem>
      <StatItem label="Doubles">
        <CountUp to={multikills.doubleKills} />
      </StatItem>
      <StatItem label="Best Spree">
        <CountUp to={multikills.largestKillingSpree} />
      </StatItem>
    </m.div>
  );
}
