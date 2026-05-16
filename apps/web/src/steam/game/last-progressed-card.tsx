import { CardShell } from "@/components/card-shell";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { useGameAchievements } from "./use-game-achievements";

interface LastProgressedCardProps {
  appid: number;
}

const DAY_MS = 86_400_000;
const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function relativeTimeAgo(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const days = Math.round(diffMs / DAY_MS);
  if (Math.abs(days) < 30) return relativeTime.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return relativeTime.format(months, "month");
  const years = Math.round(days / 365);
  return relativeTime.format(years, "year");
}

function compactAgo(ms: number): string {
  const days = Math.max(0, Math.round((Date.now() - ms) / DAY_MS));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

interface Verdict {
  verdict: string;
  indicator: string;
}

// "Recently" = within two weeks; "stale" = the unlock hasn't moved in a month.
// Chosen to match how a person would describe their relationship to a game
// out loud — under 2 weeks reads as "active," over a month reads as "set
// down," in between is ambiguous so we just report the timestamp.
const ACTIVE_DAY_THRESHOLD = 14;
const STALE_DAY_THRESHOLD = 30;

function computeVerdict({
  lastLaunchIso,
  lastUnlockIso,
  unlocked,
  total,
  hasSchema,
}: {
  lastLaunchIso: string | null;
  lastUnlockIso: string | null;
  unlocked: number;
  total: number;
  hasSchema: boolean;
}): Verdict | null {
  if (lastLaunchIso === null && lastUnlockIso === null) return null;

  const lastLaunchMs = lastLaunchIso ? new Date(lastLaunchIso).getTime() : null;
  const lastUnlockMs = lastUnlockIso ? new Date(lastUnlockIso).getTime() : null;
  const launchAgeDays =
    lastLaunchMs !== null ? Math.round((Date.now() - lastLaunchMs) / DAY_MS) : null;
  const unlockAgeDays =
    lastUnlockMs !== null ? Math.round((Date.now() - lastUnlockMs) / DAY_MS) : null;

  // 100% terminal framing wins everything — there's no more progress to track.
  if (hasSchema && total > 0 && unlocked === total) {
    const ref = lastUnlockIso ?? (lastLaunchIso as string);
    const ageMs = new Date(ref).getTime();
    return {
      verdict: `100% complete — last touched ${relativeTimeAgo(ref)}.`,
      indicator: compactAgo(ageMs),
    };
  }

  // No achievement schema (CS2, demos) → only the launch timestamp tells a
  // story. Hide entirely if we don't even have that.
  if (!hasSchema) {
    if (lastLaunchMs === null) return null;
    return {
      verdict: `Last launched ${relativeTimeAgo(lastLaunchIso as string)}.`,
      indicator: compactAgo(lastLaunchMs),
    };
  }

  // Has schema but the owner hasn't earned an unlock yet. If they've at least
  // launched, say so descriptively (per the pinned no-nudges constraint).
  if (lastUnlockMs === null) {
    if (lastLaunchMs === null) return null;
    return {
      verdict: `Launched ${relativeTimeAgo(lastLaunchIso as string)} — no achievements earned yet.`,
      indicator: compactAgo(lastLaunchMs),
    };
  }

  // Both timestamps fresh — actively in flight, just report the unlock.
  if (
    launchAgeDays !== null &&
    launchAgeDays <= ACTIVE_DAY_THRESHOLD &&
    (unlockAgeDays as number) <= ACTIVE_DAY_THRESHOLD
  ) {
    return {
      verdict: `Active recently — last unlock ${relativeTimeAgo(lastUnlockIso as string)}.`,
      indicator: compactAgo(lastUnlockMs),
    };
  }

  // Launching but not progressing — the canonical "still booting it up but
  // not actually advancing" call-out from the chunk spec.
  if (
    launchAgeDays !== null &&
    launchAgeDays <= ACTIVE_DAY_THRESHOLD &&
    (unlockAgeDays as number) > STALE_DAY_THRESHOLD
  ) {
    return {
      verdict: `Launching but not progressing — last unlock ${relativeTimeAgo(lastUnlockIso as string)}.`,
      indicator: compactAgo(lastLaunchMs as number),
    };
  }

  // Partial completion + stale unlock → the "stuck at X/Y" framing.
  if ((unlockAgeDays as number) > STALE_DAY_THRESHOLD && unlocked < total) {
    return {
      verdict: `Stuck at ${unlocked}/${total} — last unlock ${relativeTimeAgo(lastUnlockIso as string)}.`,
      indicator: compactAgo(
        lastLaunchMs !== null ? Math.max(lastLaunchMs, lastUnlockMs) : lastUnlockMs
      ),
    };
  }

  // Fallback: just report when last played, no editorial.
  const ref = lastLaunchMs ?? lastUnlockMs;
  const refIso = (lastLaunchIso ?? lastUnlockIso) as string;
  return {
    verdict: `Last played ${relativeTimeAgo(refIso)}.`,
    indicator: compactAgo(ref),
  };
}

export function LastProgressedCard({ appid }: LastProgressedCardProps) {
  // Both queries share their cache keys with the existing consumers on the
  // page (library list, AchievementPanel), so this card adds no wire fetches.
  const owned = useSteamOwnedGames();
  const ach = useGameAchievements(appid);

  if (owned.isPending || ach.isPending) return null;

  const game = owned.data?.games.find((g) => g.appid === appid);
  if (!game) return null;

  const hasSchema =
    ach.data?.achievements !== null && ach.data?.achievements !== undefined;
  const achievements = ach.data?.achievements ?? [];
  const unlocked = achievements.filter((a) => a.unlockedAt !== null).length;
  const lastUnlockIso = achievements
    .map((a) => a.unlockedAt)
    .filter((t): t is string => t !== null)
    .reduce<string | null>((latest, current) => {
      if (latest === null) return current;
      return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
    }, null);

  const computed = computeVerdict({
    lastLaunchIso: game.rtimeLastPlayedAt,
    lastUnlockIso,
    unlocked,
    total: achievements.length,
    hasSchema,
  });
  if (computed === null) return null;

  return (
    <CardShell
      title="Last progressed"
      indicator={
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {computed.indicator}
        </span>
      }
      verdict={computed.verdict}
    />
  );
}
