import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useChampionName } from "@/lol/champions/use-champions";
import { type RankEntry, formatTimeAgo } from "@vyoh/shared";
import { ProfileRankTiles } from "./profile-rank-tile";

const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

// Primary-queue rank line for the identity headline. Solo is preferred over
// Flex (the headline shows one rank; both queues still get their own tile
// below). Apex tiers drop the division the same way the rank tiles do.
function rankHeadline(entries: RankEntry[]): string | null {
  const solo = entries.find((e) => e.queueId === "RANKED_SOLO_5x5");
  const flex = entries.find((e) => e.queueId === "RANKED_FLEX_SR");
  const entry = solo ?? flex;
  if (!entry) return null;
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase();
  const division = APEX_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;
  return `${tier}${division} · ${entry.leaguePoints} LP`;
}

interface LolIdentityBlockProps {
  gameName: string | undefined;
  tagLine: string | undefined;
  profileIconId: number | null | undefined;
  summonerLevel: number | null | undefined;
  rankEntries: RankEntry[];
  // Per-queue normalized-LP series, oldest first — forwarded to the rank tiles.
  recentLpByQueue?: Record<string, number[]> | undefined;
  // Most-recent non-remake match, for the "last played X · Nh ago" sub-row.
  // Null when the match window is empty or hasn't hydrated yet.
  lastMatch?: { champion: string; playedAt: string } | null | undefined;
}

// Content-level identity for the Profile tab: a large summoner-icon avatar +
// name/rank headline, with the existing Solo/Flex rank tiles re-parented as the
// block's second section (per the nav-condensation arc, chunk 1.3a). The section
// strip keeps its own compact identity — this is the page-content counterpart,
// not a duplicate of the chrome.
export function LolIdentityBlock({
  gameName,
  tagLine,
  profileIconId,
  summonerLevel,
  rankEntries,
  recentLpByQueue,
  lastMatch,
}: LolIdentityBlockProps) {
  const ddVersion = useDDragonVersion();
  const championName = useChampionName();
  const headline = rankHeadline(rankEntries);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-4">
        <div className="relative shrink-0">
          {profileIconId != null ? (
            <img
              src={profileIconUrl(profileIconId, ddVersion)}
              alt=""
              className="size-20 rounded-full object-cover ring-2 ring-border sm:size-24"
            />
          ) : (
            <div className="size-20 animate-pulse rounded-full bg-muted ring-2 ring-border sm:size-24" />
          )}
          {summonerLevel != null && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-background px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ring-1 ring-border">
              {summonerLevel}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          {gameName ? (
            <h2 className="truncate text-2xl font-semibold sm:text-3xl">
              {gameName}
              <span className="text-muted-foreground">#{tagLine}</span>
            </h2>
          ) : (
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          )}
          <p className="text-sm font-medium text-foreground/80">
            {headline ?? "Unranked"}
          </p>
          {lastMatch && (
            <p className="text-xs text-muted-foreground">
              Last played {championName(lastMatch.champion)} ·{" "}
              {formatTimeAgo(lastMatch.playedAt)}
            </p>
          )}
        </div>
      </section>
      <ProfileRankTiles entries={rankEntries} recentLpByQueue={recentLpByQueue} />
    </div>
  );
}
