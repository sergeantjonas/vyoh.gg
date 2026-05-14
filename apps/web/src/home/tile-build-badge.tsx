function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function TileBuildBadge() {
  const relative = formatRelative(__BUILD_TIME__);
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Last deploy
      </h3>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        {relative}
      </p>
      <p className="mt-auto border-t border-border/40 pt-2.5 font-mono text-xs text-muted-foreground">
        {__BUILD_COMMIT__}
      </p>
    </div>
  );
}
