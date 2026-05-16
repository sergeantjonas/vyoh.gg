import { RarityPercent } from "@/steam/_shared/rarity-percent";
import { useCrossGameRarest } from "@/steam/use-cross-game-rarest";
import { Link } from "@tanstack/react-router";
import type { SteamRecentUnlock } from "@vyoh/shared";

const RAREST_LIMIT = 10;

// Matches the per-game RarestUnlockCard vocabulary so the cross-game and
// per-game surfaces read in the same register.
function rarityQualifier(pct: number): string {
  if (pct < 1) return "Very rare";
  if (pct < 5) return "Rare";
  if (pct < 25) return "Uncommon";
  return "Common";
}

export function RarestSection() {
  const { data, isPending, isError } = useCrossGameRarest(RAREST_LIMIT);
  const unlocks = data?.unlocks ?? [];

  // Quiet failure modes — the section is one of three signature surfaces on
  // /steam/achievements/signature; a missing leaderboard collapses rather
  // than putting a banner above the others. A genuine error renders inline.
  if (isPending) return null;
  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Rarest unlocks are unavailable right now.
      </p>
    );
  }
  // Pre-rarity-poll state (newly-added library, weekly poller hasn't run).
  if (unlocks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rarest unlocks
          <span className="ml-2 font-normal tabular-nums text-muted-foreground/60">
            {unlocks.length}
          </span>
        </h2>
        <p className="text-xs text-muted-foreground/70">By global unlock rarity</p>
      </div>
      <ul className="flex flex-col gap-2">
        {unlocks.map((u) => (
          <RarestRow key={`${u.appid}-${u.apiName}`} unlock={u} />
        ))}
      </ul>
    </section>
  );
}

function RarestRow({ unlock }: { unlock: SteamRecentUnlock }) {
  // globalPercent is non-null by construction — the backend filters rows
  // without rarity before returning — but the DTO field type stays nullable
  // since it's shared with the recent feed.
  const pct = unlock.globalPercent ?? 0;
  const qualifier = rarityQualifier(pct);
  // Mirror the per-game RarestUnlockCard's amber treatment for sub-5%, plain
  // for the rest — the visual cue does the work, no need to color every row.
  const isAmber = pct < 5;

  return (
    <li>
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(unlock.appid) }}
        search={{ ach: unlock.apiName }}
        className={
          isAmber
            ? "flex items-center gap-4 rounded-lg border border-amber-400/30 bg-amber-500/[0.04] p-4 ring-1 ring-amber-400/10 transition-colors hover:border-amber-400/50 hover:bg-amber-500/[0.07]"
            : "flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card/80"
        }
      >
        <img
          src={unlock.iconUrl}
          alt=""
          loading="lazy"
          className="size-16 shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-base font-medium text-foreground/90">
            {unlock.displayName}
          </p>
          <p className="truncate text-sm text-muted-foreground">{unlock.gameName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <RarityPercent
            percent={pct}
            className={
              isAmber
                ? "text-sm font-medium text-amber-300 decoration-amber-300/40"
                : "text-sm font-medium text-foreground/80"
            }
          />
          <span
            className={
              isAmber
                ? "text-[10px] font-medium uppercase tracking-wide text-amber-400/80"
                : "text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70"
            }
          >
            {qualifier}
          </span>
        </div>
      </Link>
    </li>
  );
}
