import type { SteamPlatform, SteamPlatformMix } from "@vyoh/shared";
import { FactCard } from "./_shared/fact-card";
import { useSteamPlatformMix } from "./use-platform-mix";

const PLATFORM_LABEL: Record<SteamPlatform, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  deck: "Steam Deck",
};

function shareOf(minutes: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((minutes / total) * 100);
}

function secondaryBreakdown(data: SteamPlatformMix): string {
  const { totalMinutes, dominantPlatform } = data;
  const entries: Array<[SteamPlatform, number]> = [
    ["windows", data.windowsMinutes],
    ["mac", data.macMinutes],
    ["linux", data.linuxMinutes],
    ["deck", data.deckMinutes],
  ];
  const rest = entries
    .filter(([platform, minutes]) => platform !== dominantPlatform && minutes > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([platform, minutes]) =>
        `${PLATFORM_LABEL[platform]} ${shareOf(minutes, totalMinutes)}%`
    );

  if (rest.length === 0) {
    return "No tracked time on the other three platforms.";
  }
  return `Also tracked: ${rest.join(", ")}.`;
}

export function PlatformMixChip() {
  const { data, isPending, isError } = useSteamPlatformMix();

  if (isPending) {
    return <FactCard title="Platforms" verdict="Loading platform mix…" empty />;
  }

  if (isError || !data) {
    return (
      <FactCard
        title="Platforms"
        verdict="Platform mix is unavailable right now."
        empty
      />
    );
  }

  if (data.totalMinutes === 0 || data.dominantPlatform === null) {
    return (
      <FactCard
        title="Platforms"
        verdict="No per-OS playtime has been reported yet."
        prescription="Steam only reports per-platform minutes once a game has been launched on that OS."
        empty
      />
    );
  }

  const totalHours = Math.round(data.totalMinutes / 60);
  const dominantMinutesByPlatform: Record<SteamPlatform, number> = {
    windows: data.windowsMinutes,
    mac: data.macMinutes,
    linux: data.linuxMinutes,
    deck: data.deckMinutes,
  };
  const dominantMinutes = dominantMinutesByPlatform[data.dominantPlatform];
  const dominantShare = shareOf(dominantMinutes, data.totalMinutes);
  const verdict = `${PLATFORM_LABEL[data.dominantPlatform]} accounts for ${dominantShare}% of all tracked playtime.`;

  return (
    <FactCard
      title="Platforms"
      metric={totalHours}
      metricLabel={{ singular: "hour", plural: "hours" }}
      verdict={verdict}
      prescription={secondaryBreakdown(data)}
    />
  );
}
