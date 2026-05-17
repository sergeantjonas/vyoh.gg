import { useHomeFirstPlayed } from "@/home/use-home-first-played";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import { formatHoursMinutes } from "@vyoh/shared";
import type { HomeFirstPlayed } from "@vyoh/shared";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "today";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
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
  const resolvedName = championName(data.champion);
  const losses = data.matchCount - data.wins;
  const record = `${data.matchCount} ${data.matchCount === 1 ? "match" : "matches"} (${data.wins}W-${losses}L)`;
  const headline = `${resolvedName} · LoL`;
  const detail = `${formatRelative(data.firstPlayedAt)} · ${record}`;
  const icon = (
    <ChampionSquareIcon
      championName={data.champion}
      alt={resolvedName}
      className="size-10 shrink-0 rounded-md ring-1 ring-border/60"
    />
  );
  return (
    <Shell>
      <Heading />
      {data.accountSlug ? (
        <Link
          to="/lol/$accountSlug/matches/$matchId"
          params={{ accountSlug: data.accountSlug, matchId: data.matchId }}
          className="group flex items-center gap-3"
        >
          {icon}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-base font-semibold leading-snug text-foreground/90 group-hover:text-foreground">
              {headline}
            </span>
            <span className="text-sm text-muted-foreground">{detail}</span>
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          {icon}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-base font-semibold leading-snug text-foreground/90">
              {headline}
            </p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
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
