import { EmptyDuosIllustration, EmptyState } from "@/components/empty-state";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useDuos } from "@/lol/profile/use-duos";
import { type Variants, m } from "motion/react";

const DISPLAY_COUNT = 3;

export function ProfileDuos({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useDuos(account);

  // Hide while loading so the Profile doesn't reserve empty space during the
  // initial fetch. Once the response lands we either render duos or the
  // "mostly solo" empty state.
  if (isPending || !data) return null;

  if (data.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Duos</h3>
        <div className="rounded-lg border border-dashed bg-card/20">
          <EmptyState
            illustration={<EmptyDuosIllustration />}
            title="No recurring duo detected"
            hint="You mostly queue solo in this window."
            className="py-4"
          />
        </div>
      </section>
    );
  }

  const duos = data.slice(0, DISPLAY_COUNT);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Duos</h3>
      <m.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="flex flex-col gap-2"
      >
        {duos.map((d) => {
          const losses = d.games - d.wins;
          const wr = Math.round((d.wins / d.games) * 100);
          return (
            <m.div
              key={d.puuid}
              variants={rowVariants}
              className="flex items-center gap-3 rounded-lg border bg-card/40 px-3 py-2"
            >
              <ChampionSquareIcon
                championName={d.topChampion}
                alt={d.topChampion}
                className="size-9 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {d.gameName}
                  <span className="text-muted-foreground">#{d.tagLine}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Most often plays {d.topChampion}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm tabular-nums text-foreground/90">
                  <span className="text-emerald-500/80">{d.wins}</span>
                  <span className="text-muted-foreground/40">{"–"}</span>
                  <span className="text-rose-500/80">{losses}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {d.games} games · {wr}% WR
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
