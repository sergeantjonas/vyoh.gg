import { useHomeFirstPlayed } from "@/home/use-home-first-played";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import type { HomeFirstPlayed } from "@vyoh/shared";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "today";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatHoursMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
      Newest in the rotation
    </h3>
  );
}

function Empty({ verdict }: { verdict: string }) {
  return (
    <Shell>
      <Heading />
      <p className="text-base font-semibold leading-snug text-muted-foreground/70">
        {verdict}
      </p>
    </Shell>
  );
}

function LolView({ data }: { data: Extract<HomeFirstPlayed, { kind: "lol" }> }) {
  const championName = useChampionName();
  const losses = data.matchCount - data.wins;
  const record = `${data.matchCount} ${data.matchCount === 1 ? "match" : "matches"} (${data.wins}W-${losses}L)`;
  const headline = `${championName(data.champion)} · LoL`;
  const detail = `${formatRelative(data.firstPlayedAt)} · ${record}`;
  return (
    <Shell>
      <Heading />
      {data.accountSlug ? (
        <Link
          to="/lol/$accountSlug/champions/$championKey"
          params={{ accountSlug: data.accountSlug, championKey: data.champion }}
          className="group flex flex-col gap-0.5"
        >
          <span className="text-base font-semibold leading-snug text-foreground/90 group-hover:text-foreground">
            {headline}
          </span>
          <span className="text-sm text-muted-foreground">{detail}</span>
        </Link>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold leading-snug text-foreground/90">
            {headline}
          </p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      )}
    </Shell>
  );
}

function SteamView({ data }: { data: Extract<HomeFirstPlayed, { kind: "steam" }> }) {
  return (
    <Shell>
      <Heading />
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(data.appid) }}
        className="group flex flex-col gap-0.5"
      >
        <span className="truncate text-base font-semibold leading-snug text-foreground/90 group-hover:text-foreground">
          {data.name} · Steam
        </span>
        <span className="text-sm text-muted-foreground">
          {formatRelative(data.firstPlayedAt)} · {formatHoursMinutes(data.totalMinutes)}{" "}
          so far
        </span>
      </Link>
    </Shell>
  );
}

export function TileFirstPlayed() {
  const query = useHomeFirstPlayed();
  if (query.isPending) return <Empty verdict="Looking for what's new…" />;
  if (!query.data) return <Empty verdict="No rotation signal available." />;
  if (query.data.kind === "none") {
    return <Empty verdict={`Same rotation as the last ${query.data.windowDays} days.`} />;
  }
  if (query.data.kind === "lol") return <LolView data={query.data} />;
  return <SteamView data={query.data} />;
}
