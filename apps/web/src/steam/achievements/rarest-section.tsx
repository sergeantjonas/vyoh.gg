import { AchievementCardInner } from "@/steam/_shared/achievement-card";
import { useCrossGameRarest } from "@/steam/use-cross-game-rarest";
import { Link } from "@tanstack/react-router";
import type { SteamRecentUnlock } from "@vyoh/shared";

const RAREST_LIMIT = 50;

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
  // Sub-5% rows get the amber container chrome to keep the section's "rarest
  // flex" identity. The amber name + rarity badge styling itself lives in
  // <AchievementCardInner> (driven by rareTier), so we only own the wrapper.
  const isAmber = pct < 5;

  return (
    <li>
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(unlock.appid) }}
        search={{ ach: unlock.apiName }}
        className={
          isAmber
            ? "flex items-start gap-4 rounded-lg border border-amber-400/30 bg-amber-500/[0.04] p-4 ring-1 ring-amber-400/10 transition-colors hover:border-amber-400/50 hover:bg-amber-500/[0.07]"
            : "flex items-start gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card/80"
        }
      >
        <AchievementCardInner
          appid={unlock.appid}
          apiName={unlock.apiName}
          displayName={unlock.displayName}
          description={unlock.description}
          globalPercent={unlock.globalPercent}
          unlocked
          metaLine={unlock.gameName}
        />
      </Link>
    </li>
  );
}
