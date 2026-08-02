import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { useSteamPlatformMix } from "@/steam/use-platform-mix";
import type { SteamPlatform, SteamPlatformMix } from "@vyoh/shared";
import { formatPercent, formatPlaytime } from "@vyoh/shared";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Platform";

const PLATFORM_LABEL: Record<SteamPlatform, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  deck: "Steam Deck",
};

// Below this the unattributed remainder is rounding, above it the card would
// be quoting a share of a number it hasn't disclosed is partial.
const COVERAGE_GAP_FLOOR = 0.05;

function minutesByPlatform(mix: SteamPlatformMix): Array<[SteamPlatform, number]> {
  return [
    ["windows", mix.windowsMinutes],
    ["mac", mix.macMinutes],
    ["linux", mix.linuxMinutes],
    ["deck", mix.deckMinutes],
  ];
}

export function PlatformIdentityCard() {
  const query = useSteamPlatformMix();
  const portrait = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the platform split…"
      errorLabel="The platform split is unavailable right now."
      emptyLabel="No per-OS playtime has been reported yet."
      emptyPrescription="Steam only reports per-platform minutes once a game has been launched on that OS."
      isEmpty={(data) => data.totalMinutes === 0 || data.dominantPlatform === null}
    >
      {(mix) => {
        const dominant = mix.dominantPlatform;
        if (dominant === null) return null;

        const others = minutesByPlatform(mix)
          .filter(([platform, minutes]) => platform !== dominant && minutes > 0)
          .sort((a, b) => b[1] - a[1]);
        const dominantMinutes =
          minutesByPlatform(mix).find(([platform]) => platform === dominant)?.[1] ?? 0;

        // Steam attributes per-OS minutes only from the point a title started
        // reporting them, so the platform total sits below lifetime playtime
        // on an old library. Quoting a share without saying which total it is
        // a share *of* would overstate what this card knows.
        const lifetimeMinutes = portrait.data?.posture.totalMinutes ?? 0;
        const uncovered = lifetimeMinutes - mix.totalMinutes;
        const coverageNote =
          lifetimeMinutes > 0 && uncovered / lifetimeMinutes > COVERAGE_GAP_FLOOR
            ? ` Steam attributes ${formatPercent(mix.totalMinutes / lifetimeMinutes)} of your lifetime playtime to a platform at all.`
            : "";

        return (
          <FactCard
            title={TITLE}
            metric={others.length + 1}
            metricLabel={{ singular: "platform", plural: "platforms" }}
            verdict={
              others.length === 0
                ? `${PLATFORM_LABEL[dominant]}, exclusively.`
                : `${PLATFORM_LABEL[dominant]} carries ${formatPercent(dominantMinutes / mix.totalMinutes)} of tracked playtime.`
            }
            prescription={
              others.length === 0
                ? `All ${formatPlaytime(mix.totalMinutes)} of tracked per-OS playtime, on one machine.${coverageNote}`
                : `Also tracked: ${others.map(([platform, minutes]) => `${PLATFORM_LABEL[platform]} ${formatPercent(minutes / mix.totalMinutes)}`).join(", ")}.${coverageNote}`
            }
          />
        );
      }}
    </FactCardData>
  );
}
