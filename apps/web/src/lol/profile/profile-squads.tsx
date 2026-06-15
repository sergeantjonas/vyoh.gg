import { SectionTitle } from "@/components/ui/section-title";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { useSquads } from "@/lol/profile/use-squads";
import { formatPercent } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const DISPLAY_COUNT = 3;

// Owner + members. 3 = trio, 4 = a 4-stack, 5 = full premade.
const STACK_LABEL: Record<number, string> = {
  3: "Trio",
  4: "4-stack",
  5: "5-stack",
};

export function ProfileSquads({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const championName = useChampionName();
  const { data, isPending } = useSquads(account);

  // Squads are rarer than duos, so this section renders nothing (no empty state)
  // until a real 3+ stack surfaces — the Profile shouldn't carry a permanent
  // empty "Squads" zone for the common solo/duo-only case.
  if (isPending || !data || data.length === 0) return null;

  const squads = data.slice(0, DISPLAY_COUNT);

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Squads</SectionTitle>
      <m.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="flex flex-col gap-2"
      >
        {squads.map((s) => {
          const losses = s.games - s.wins;
          const wr = formatPercent(s.wins / s.games);
          const key = s.members.map((member) => member.puuid).join("|");
          return (
            <m.div
              key={key}
              variants={rowVariants}
              className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2 backdrop-blur-sm"
            >
              <div className="flex -space-x-2">
                {s.members.map((member) => (
                  <ChampionSquareIcon
                    key={member.puuid}
                    championName={member.topChampion}
                    alt={championName(member.topChampion)}
                    className="size-9 rounded-md ring-2 ring-card"
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {s.members.map((member) => member.gameName).join(", ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {STACK_LABEL[s.size] ?? `${s.size}-stack`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm tabular-nums text-foreground/90">
                  <span className="text-emerald-500/80">{s.wins}</span>
                  <span className="text-muted-foreground/40">{"–"}</span>
                  <span className="text-rose-500/80">{losses}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {s.games} games · {wr} WR
                </div>
              </div>
            </m.div>
          );
        })}
      </m.div>
    </section>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};
