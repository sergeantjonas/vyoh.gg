import { CountUp } from "@/components/count-up";
import { HeroLabel, HeroNumber } from "@/components/ui/hero-number";
import { SectionTitle } from "@/components/ui/section-title";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { useAramProfile } from "@/lol/profile/use-aram-profile";
import { formatPercent } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

// ARAM is most-played, so a meaningful sample arrives quickly; below this the
// section renders nothing (the Profile carries no permanent empty zone).
const MIN_GAMES = 10;

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
};

// Compact thousands for the sustain/tank numbers (avg per game runs 5k–40k).
function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

function StatTile({
  label,
  children,
  caption,
}: {
  label: string;
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <m.div
      variants={item}
      className="flex flex-1 flex-col items-center gap-1.5 px-4 py-3"
    >
      <HeroLabel>{label}</HeroLabel>
      <HeroNumber size="md">{children}</HeroNumber>
      {caption ? (
        <span className="text-[11px] text-muted-foreground/70">{caption}</span>
      ) : null}
    </m.div>
  );
}

const STRIP_CLASS =
  "flex divide-x divide-border rounded-lg border bg-card/60 backdrop-blur-sm";

export function ProfileAramDashboard({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const championName = useChampionName();
  const { data, isPending } = useAramProfile(account);

  if (isPending || !data || data.games < MIN_GAMES) return null;

  const winRate = Math.round((data.wins / data.games) * 100);
  const kda = (data.kills + data.assists) / Math.max(data.deaths, 1);
  const perGame = (total: number) => compact(total / data.games);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>ARAM</SectionTitle>
      <m.div initial="hidden" animate="show" variants={container} className={STRIP_CLASS}>
        <StatTile label="Games">
          <CountUp to={data.games} />
        </StatTile>
        <StatTile label="Win Rate">
          <CountUp to={winRate} />%
        </StatTile>
        <StatTile label="KDA">{kda.toFixed(2)}</StatTile>
      </m.div>
      <m.div initial="hidden" animate="show" variants={container} className={STRIP_CLASS}>
        <StatTile label="Heal + Shield" caption="avg / game">
          {perGame(data.healAndShield)}
        </StatTile>
        <StatTile label="Dmg Taken" caption="avg / game">
          {perGame(data.damageTaken)}
        </StatTile>
        <StatTile label="Self-Mitigated" caption="avg / game">
          {perGame(data.selfMitigated)}
        </StatTile>
      </m.div>
      {data.topChampions.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-card/60 p-3 backdrop-blur-sm">
          {data.topChampions.map((champ) => (
            <div key={champ.championName} className="flex items-center gap-2.5">
              <ChampionSquareIcon
                championName={champ.championName}
                className="size-8 rounded"
              />
              <span className="flex-1 truncate text-sm text-foreground/90">
                {championName(champ.championName)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {champ.games}G · {formatPercent(champ.wins / champ.games)} WR
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
