import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { abilityIconUrl } from "@/lol/_shared/assets/champion-icon";
import { ChangeKindGlyph } from "@/lol/patches/change-kind-glyph";
import type { ChampionPatchChangeGroup } from "@vyoh/shared";

export type AbilityGroup = {
  key: string;
  slot: string | null;
  abilityNames: string[];
  abilityIndex: number | null;
  changes: ChampionPatchChangeGroup["changes"];
};

export function groupBySlot(
  changes: ChampionPatchChangeGroup["changes"]
): AbilityGroup[] {
  const map = new Map<string, AbilityGroup>();
  for (const line of changes) {
    const key =
      line.ability === "Base" ? "__base__" : (line.slot ?? line.ability ?? "__base__");
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        slot: line.slot,
        abilityNames: [],
        // Multi-variant slots (Karma W: Focused Resolve / Renewal) carry
        // different abilityIndexes per variant; the slot icon is the same so
        // we anchor on the first variant's index.
        abilityIndex: line.abilityIndex,
        changes: [],
      };
      map.set(key, entry);
    }
    if (line.ability && !entry.abilityNames.includes(line.ability)) {
      entry.abilityNames.push(line.ability);
    }
    entry.changes.push(line);
  }
  return [...map.values()];
}

export function AbilityChangeList({
  changes,
  championId,
  patch,
  className,
}: {
  changes: ChampionPatchChangeGroup["changes"];
  // championId + patch compose the proxy URL via abilityIconUrl. Null
  // championId (champion not in our static sync yet) suppresses every
  // ability icon in the list — the chip and text still render.
  championId: number | null;
  patch: string;
  className?: string;
}) {
  const groups = groupBySlot(changes);
  return (
    <ul className={cn("flex flex-col gap-0 text-xs text-muted-foreground", className)}>
      {groups.map((sg, idx) => {
        const iconSrc =
          championId !== null && sg.slot && sg.abilityIndex !== null
            ? abilityIconUrl(championId, sg.slot, sg.abilityIndex, patch)
            : null;
        return (
          <li key={sg.key}>
            {groups.length > 1 && idx > 0 && (
              <Separator className="my-2.5 bg-border/50" />
            )}
            {sg.key !== "__base__" ? (
              <div className="mb-0.5 flex items-center gap-1.5">
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="size-4 shrink-0 rounded-sm" />
                ) : null}
                {sg.slot ? (
                  <span className="rounded-sm bg-muted px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground/70">
                    {sg.slot}
                  </span>
                ) : null}
                {sg.abilityNames.length > 0 ? (
                  <span className="text-foreground/80">
                    {sg.abilityNames.join(" / ")}
                  </span>
                ) : null}
              </div>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {sg.changes.map((line, ci) => (
                <li
                  key={`${sg.key}-${ci}`}
                  className={cn(
                    "flex items-start gap-1.5",
                    sg.key !== "__base__" && "pl-5"
                  )}
                >
                  <ChangeKindGlyph kind={line.changeType} />
                  <span className="min-w-0">{line.changeText}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
