import { SectionTitle } from "@/components/ui/section-title";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import { useRecentUnlocks } from "@/steam/use-recent-unlocks";
import { Link } from "@tanstack/react-router";
import { formatTimeAgo } from "@vyoh/shared";

function Shell({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative">
      <div className="flex flex-col gap-6 py-12 sm:py-16">
        <SectionTitle as="h2">{eyebrow}</SectionTitle>
        {children}
      </div>
    </section>
  );
}

export function LandingSteamBand() {
  const { data, isPending, isError } = useRecentUnlocks(1);

  if (isPending || isError || !data) {
    return (
      <Shell eyebrow="Steam · latest unlock">
        <div
          aria-hidden
          className="h-20 w-full max-w-md animate-pulse rounded-lg bg-card/40"
        />
      </Shell>
    );
  }

  const [latest] = data.unlocks;
  if (!latest) {
    return (
      <Shell eyebrow="Steam · latest unlock">
        <p className="text-base text-muted-foreground">
          A recent achievement will land here once one fires.
        </p>
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Steam · latest unlock">
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(latest.appid) }}
        search={{ ach: latest.apiName }}
        className="group flex items-center gap-4 rounded-lg transition-colors"
      >
        <img
          src={steamAchievementIconUrl(latest.appid, latest.apiName)}
          alt=""
          loading="lazy"
          className="size-14 shrink-0 rounded-lg ring-1 ring-border/60"
        />
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-semibold text-2xl text-foreground transition-colors group-hover:text-foreground/80 sm:text-3xl">
            {latest.displayName}
          </p>
          <p className="truncate text-muted-foreground text-sm">
            Unlocked in {latest.gameName} · {formatTimeAgo(latest.unlockedAt)}
          </p>
        </div>
      </Link>
    </Shell>
  );
}
