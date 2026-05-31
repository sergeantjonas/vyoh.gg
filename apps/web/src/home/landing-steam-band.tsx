import { SectionTitle } from "@/components/ui/section-title";
import {
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import { mainScrollRef } from "@/lib/scroll-container";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import { useRecentUnlocks } from "@/steam/use-recent-unlocks";
import { Link } from "@tanstack/react-router";
import { formatTimeAgo } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";

// The band sits right below a `min-h-[85vh]` hero so a fair chunk of it (~60%
// on a typical viewport) is already inside <main>'s clip at scrollTop=0 — too
// much for any `amount:` threshold to gate against. The negative bottom
// `margin` shrinks the observer's effective root by 30% of <main>'s height, so
// the band's top has to scroll past the 70%-of-viewport line before the IO
// counts intersection at all. Pairs with `amount: 0.5` so the cascade lands
// when the band is meaningfully on-screen, not the moment its top edge peeks
// past the threshold. `root: mainScrollRef` keeps the observer rooted on the
// actual scroll container (<main>, not window).
const BAND_VIEWPORT = {
  once: true,
  amount: 0.5,
  root: mainScrollRef,
  margin: "0px 0px -30% 0px",
} as const;

const WILL_CHANGE_CLASS = "[will-change:transform,opacity,filter]";

function Shell({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const containerVariants = reducedMotion
    ? sectionReducedContainerVariants
    : sectionContainerVariants;

  return (
    <m.section
      className="relative"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={BAND_VIEWPORT}
    >
      <div className="flex flex-col gap-6 py-12 sm:py-16">
        <m.div
          className={reducedMotion ? undefined : WILL_CHANGE_CLASS}
          {...(reducedMotion ? {} : { variants: sectionChildVariants.eyebrow })}
        >
          <SectionTitle as="h2">{eyebrow}</SectionTitle>
        </m.div>
        <m.div
          className={reducedMotion ? undefined : WILL_CHANGE_CLASS}
          {...(reducedMotion ? {} : { variants: sectionChildVariants.body })}
        >
          {children}
        </m.div>
      </div>
    </m.section>
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
