import { championIconUrl } from "@/lib/champion-icon";
import { itemIconUrl } from "@/lib/item-icon";
import { cn } from "@/lib/utils";
import { useSplashChampion } from "@/lol/splash-backdrop";
import type { MatchDetail, ParticipantDetail } from "@vyoh/shared";

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function ItemSlots({ items }: { items: number[] }) {
  return (
    <div className="flex gap-0.5">
      {items.map((id, i) => {
        const url = itemIconUrl(id);
        return url ? (
          <img
            // biome-ignore lint/suspicious/noArrayIndexKey: items array has fixed positions (slots 0-6)
            key={i}
            src={url}
            alt={`Item ${id}`}
            className="size-5 rounded-sm bg-muted"
            loading="lazy"
          />
        ) : (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: items array has fixed positions (slots 0-6)
            key={i}
            className="size-5 rounded-sm bg-muted/40"
          />
        );
      })}
    </div>
  );
}

function ParticipantRow({
  p,
  isMe,
}: {
  p: ParticipantDetail;
  isMe?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card/60 p-2 backdrop-blur-sm transition-colors",
        isMe && "border-foreground/40 bg-card/80 ring-2 ring-foreground/30"
      )}
    >
      <img
        src={championIconUrl(p.championName)}
        alt={p.championName}
        loading="lazy"
        className="size-9 rounded-md"
      />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{p.championName}</div>
        <div className="font-mono text-xs tabular-nums">
          <span className="text-emerald-400">{p.kills}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-red-400">{p.deaths}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-amber-400">{p.assists}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <ItemSlots items={p.items} />
        <div className="font-mono text-xs text-muted-foreground">
          {Math.round(p.goldEarned / 1000)}k g · {Math.round(p.totalDamage / 1000)}k dmg
        </div>
      </div>
    </li>
  );
}

function TeamBlock({
  title,
  participants,
  myPuuid,
}: {
  title: string;
  participants: ParticipantDetail[];
  myPuuid?: string;
}) {
  const win = participants[0]?.win ?? false;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-medium">
        <span>{title}</span>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            win ? "text-emerald-400" : "text-red-400"
          )}
        >
          {win ? "Win" : "Loss"}
        </span>
      </h3>
      <ul className="flex flex-col gap-1">
        {participants.map((p) => (
          <ParticipantRow key={p.puuid} p={p} isMe={p.puuid === myPuuid} />
        ))}
      </ul>
    </section>
  );
}

export function MatchDetailView({
  detail,
  currentChampion,
  myPuuid,
}: {
  detail: MatchDetail;
  currentChampion?: string;
  myPuuid?: string;
}) {
  const blue = detail.participants.filter((p) => p.teamId === 100);
  const red = detail.participants.filter((p) => p.teamId === 200);
  const playedAt = new Date(detail.playedAt);

  useSplashChampion(currentChampion);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {currentChampion && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {currentChampion}
          </span>
        )}
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-semibold">{detail.queueType}</h2>
          <span className="text-sm text-muted-foreground">
            {formatDuration(detail.durationSec)} ·{" "}
            {playedAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TeamBlock title="Blue side" participants={blue} myPuuid={myPuuid} />
        <TeamBlock title="Red side" participants={red} myPuuid={myPuuid} />
      </div>
    </div>
  );
}
