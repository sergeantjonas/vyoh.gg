export function ProfileSteamSection() {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Steam</div>
      <p className="text-sm text-muted-foreground/80">
        Steam panels will land here — currently / recently played, library composition,
        wishlist, and per-game achievements.
      </p>
    </div>
  );
}
