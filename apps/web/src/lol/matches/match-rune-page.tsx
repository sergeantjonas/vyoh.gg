import { SectionTitle } from "@/components/ui/section-title";
import { usePerks } from "@/lol/_shared/analytics/use-perks";
import { KeystoneIcon as PerkIcon } from "@/lol/_shared/assets/keystone-icon";
import type { ParticipantDetail, ParticipantOwnerExtras, RuneTree } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";

// Y-only entrance, same reason as MatchOwnerStats: the card is frosted and an
// opacity tween on its ancestor would suppress the backdrop-filter mid-flight.
const springIn = {
  initial: { y: 8 },
  animate: { y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.2 },
} as const;

const SHARD_SLOTS = [
  { key: "offense", label: "Offense" },
  { key: "flex", label: "Flex" },
  { key: "defense", label: "Defense" },
] as const;

type Shards = NonNullable<ParticipantOwnerExtras["runes"]>["shards"];

function Tree({ tree, primary }: { tree: RuneTree; primary: boolean }) {
  const perks = usePerks();
  const first = tree.perks[0];
  const treeName = first === undefined ? undefined : perks?.get(first)?.path;
  const label = treeName ?? (primary ? "Primary" : "Secondary");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ul aria-label={`${label} runes`} className="flex items-center gap-2">
        {tree.perks.map((id, i) => (
          <li key={`${i}-${id}`} className="flex">
            <PerkIcon id={id} className={primary && i === 0 ? "size-10" : "size-7"} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShardRow({ shards }: { shards: Shards }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">Shards</span>
      <ul aria-label="Stat shards" className="flex flex-col gap-1.5">
        {SHARD_SLOTS.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-2">
            <PerkIcon id={shards[key]} className="size-5" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchRunePage({
  detail,
  myPuuid,
}: {
  detail: { participants: ParticipantDetail[] };
  myPuuid?: string | undefined;
}) {
  const reduced = useReducedMotion();

  const me = myPuuid ? detail.participants.find((p) => p.puuid === myPuuid) : undefined;
  const runes = me?.owner?.runes;
  if (!runes) return null;

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <SectionTitle>Runes</SectionTitle>
      <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-md border bg-card/60 p-4 backdrop-blur-sm">
        <Tree tree={runes.primary} primary />
        <Tree tree={runes.secondary} primary={false} />
        <ShardRow shards={runes.shards} />
      </div>
    </m.section>
  );
}
