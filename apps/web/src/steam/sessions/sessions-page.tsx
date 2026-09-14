import { SectionTitle } from "@/components/ui/section-title";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { HourHeatmapCard } from "./hour-heatmap";
import { LastSessionHero } from "./last-session-hero";
import { RecordsBand } from "./records-band";
import { SESSIONS_WEEKS, useSteamSessions } from "./use-sessions";

const SINCE = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Bare wrapper, chromed children, as on the portrait: the hero is a magazine
// spread and the chips carry their own frosted shells. The header's footnote
// is load-bearing rather than decorative — sessions exist only where the api
// was running, so every number on the page is "of what we saw", and the page
// says since when.
export function SessionsPage() {
  const { data } = useSteamSessions();
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle as="h2">Sessions</SectionTitle>
        {data?.window.observedSince && (
          <p className="text-muted-foreground/70 text-xs tabular-nums">
            {data.window.sessionCount} observed{" "}
            {data.window.sessionCount === 1 ? "session" : "sessions"} in {SESSIONS_WEEKS}{" "}
            weeks · watching since {SINCE.format(new Date(data.window.observedSince))}
          </p>
        )}
      </div>
      <LastSessionHero />
      <RecordsBand />
      <HourHeatmapCard />
    </section>
  );
}
