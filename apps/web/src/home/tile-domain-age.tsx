// First commit on this repo. Decided 2026-05-14 over deploy/registration:
// truthful and always derivable.
const LAUNCH_ISO = "2026-05-06";

function daysSince(iso: string): number {
  const launch = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - launch) / 86_400_000));
}

export function TileDomainAge() {
  const days = daysSince(LAUNCH_ISO);
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Domain age
      </h3>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        Live for {days} {days === 1 ? "day" : "days"}
      </p>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        First commit {LAUNCH_ISO}
      </p>
    </div>
  );
}
