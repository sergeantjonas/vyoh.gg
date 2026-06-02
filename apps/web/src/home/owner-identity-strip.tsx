import { usePrimaryAccount } from "@/home/use-primary-account";
import { rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import { Link } from "@tanstack/react-router";
import { formatRank } from "@vyoh/shared/lol/rank-history";

/**
 * Subtle owner attribution row sitting under the landing heading — avatar +
 * name#tag + current rank for the primary owner account. Renders nothing
 * until `/me` has resolved so we don't reserve space for an account that
 * may not exist on a fresh deploy. The whole strip is a link into the
 * primary profile so the landing acts as a doorway, not a dead-end.
 */
export function OwnerIdentityStrip() {
  const { account } = usePrimaryAccount();
  const ddVersion = useDDragonVersion();
  const emblemYear = useRankedEmblemYear();

  if (!account) return null;

  const profileIconId = account.profileIconId;
  const rank = account.summary?.rank ?? null;

  return (
    <Link
      to="/lol/$accountSlug"
      params={{ accountSlug: account.slug }}
      className="group flex items-center gap-3 rounded-full border bg-card/40 px-3 py-1.5 text-sm transition-colors hover:bg-card/70"
    >
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/40">
        {profileIconId != null ? (
          <img
            src={profileIconUrl(profileIconId, ddVersion)}
            alt=""
            className="size-7 object-cover"
          />
        ) : null}
      </span>
      <span className="flex items-baseline gap-1.5 tabular-nums">
        <span className="font-medium text-foreground/90">{account.gameName}</span>
        <span className="text-muted-foreground">#{account.tagLine}</span>
      </span>
      {rank ? (
        <span className="flex items-center gap-1.5 border-l pl-3 text-xs text-muted-foreground">
          <img
            src={rankEmblemUrl(rank.tier, emblemYear)}
            alt={rank.tier}
            className="size-4 object-contain"
          />
          <span>{formatRank(rank.tier, rank.division, rank.leaguePoints)}</span>
        </span>
      ) : null}
    </Link>
  );
}
