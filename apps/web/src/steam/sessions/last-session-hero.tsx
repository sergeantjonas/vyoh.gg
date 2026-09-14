import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
  SECTION_CHILD_WILL_CHANGE,
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import { formatRarityPercent } from "@/steam/_shared/rarity-percent";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import { useSteamGameBackdrop } from "@/steam/profile-backdrop";
import { Link } from "@tanstack/react-router";
import {
  OWNER_TIME_ZONE,
  type SteamPlaySessionDigest,
  type SteamSessionUnlock,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { clockOf, headlineFor } from "./session-copy";
import { useSteamSessions } from "./use-sessions";

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

// The page's opening statement: how long the last session ran, as the
// masthead, and the one thing about it worth saying, as prose. Which thing is
// the beat model's call — a marathon, a return after months, a streak, the
// rarest unlock — so a session with nothing unlocked still opens the page with
// a claim rather than an apology. The unlocks, when there are any, sit under
// the prose as a row of icons; when there are none the row is simply absent.
export function LastSessionHero() {
  const { data, isPending, isError } = useSteamSessions();
  const reducedMotion = useReducedMotion();
  const latest = data?.sessions[0];

  return (
    <m.div
      className="flex flex-col gap-4"
      variants={
        reducedMotion ? sectionReducedContainerVariants : sectionContainerVariants
      }
      initial="hidden"
      animate="visible"
    >
      {latest && <BackdropClaim appid={latest.game.appid} />}
      <m.p
        variants={sectionChildVariants.eyebrow}
        style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
        className="text-muted-foreground text-sm"
      >
        {latest ? `Last session · ${latest.game.name}` : "Last session"}
      </m.p>
      <EditorialHeading
        delegated
        as="h3"
        magnitude="medium"
        className="font-[680] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] -tracking-[0.02em] tabular-nums"
      >
        {latest ? headlineFor(latest).masthead : mastheadFor({ isPending, isError })}
      </EditorialHeading>

      <m.p
        variants={sectionChildVariants.body}
        style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
        className="text-pretty text-foreground/80 text-base leading-relaxed sm:text-lg"
      >
        {latest ? headlineFor(latest).sentence : proseFor({ isPending, isError })}
      </m.p>

      {latest && (
        <m.div
          variants={sectionChildVariants.meta}
          style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
          className="flex flex-col gap-3"
        >
          <p className="text-muted-foreground text-sm tabular-nums">
            {DAY.format(new Date(latest.startedAt))} · {clockOf(latest.startedAt)} to{" "}
            {clockOf(latest.endedAt)}
          </p>
          <SupportingChips session={latest} />
          {latest.unlocks.length > 0 && (
            <UnlockRow appid={latest.game.appid} unlocks={latest.unlocks} />
          )}
        </m.div>
      )}
    </m.div>
  );
}

// Hooks cannot be conditional, and the claim needs an appid, so the claim
// lives in a child that only mounts once the session is known.
function BackdropClaim({ appid }: { appid: number }) {
  // No enrichment row in this payload, so no cache-buster: the backdrop
  // resolves the current art without it, as the live-state chips do.
  useSteamGameBackdrop({ appid, assetTimestamp: null });
  return null;
}

function SupportingChips({ session }: { session: SteamPlaySessionDigest }) {
  const { chips } = headlineFor(session);
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Also notable">
      {chips.map((chip) => (
        <li
          key={chip}
          className="rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-foreground/80 text-xs"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

// Unlocked by definition, so names and icons reveal fully — Steam's own client
// drops the spoiler mask the moment an achievement is earned.
function UnlockRow({ appid, unlocks }: { appid: number; unlocks: SteamSessionUnlock[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Unlocked in this session">
      {unlocks.map((u) => (
        <li key={u.apiName}>
          <Link
            to="/steam/library/$appid"
            params={{ appid: String(appid) }}
            search={{ ach: u.apiName }}
            className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 py-1.5 pr-3 pl-1.5 transition-colors hover:bg-card/70"
          >
            <img
              src={steamAchievementIconUrl(appid, u.apiName)}
              alt=""
              loading="lazy"
              className="size-8 shrink-0 rounded"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground/90 text-sm">
                {u.displayName}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {u.globalPercent === null
                  ? clockOf(u.unlockedAt)
                  : `${clockOf(u.unlockedAt)} · ${formatRarityPercent(u.globalPercent)} of players`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function mastheadFor({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return "Reading the log";
  if (isError) return "Unavailable";
  return "No session yet";
}

function proseFor({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return "Finding the last time a game was open…";
  if (isError) return "The session log is unavailable right now.";
  return "No closed session has been observed yet — the presence poller records one per launch while the api is running.";
}
