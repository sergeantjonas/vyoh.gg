import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
  SECTION_CHILD_WILL_CHANGE,
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import { type GenreShare, formatPlaytime } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { joinGenres, leadingGenres, shareOf } from "./leading-genres";
import { useSteamPortrait } from "./use-portrait";

const EYEBROW = "Genre anchor";

// The section's opening statement rather than the first of five equal tiles:
// one genre names the player, the sentence under it earns the name, and the
// rows under that let a reader disagree with both. Bare wrapper — the band is
// a magazine spread, so the chrome lives on the chips below it, not here.
export function PortraitHero() {
  const { data, isPending, isError } = useSteamPortrait();
  const reducedMotion = useReducedMotion();

  const leading = data === undefined ? [] : leadingGenres(data.lifetime.genres);
  const anchor = leading[0];

  return (
    <m.div
      className="flex flex-col gap-5"
      variants={
        reducedMotion ? sectionReducedContainerVariants : sectionContainerVariants
      }
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <m.span
          variants={sectionChildVariants.eyebrow}
          style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
          className="font-medium text-[10px] text-muted-foreground/70 uppercase tracking-[0.3em]"
        >
          {EYEBROW}
        </m.span>
        <EditorialHeading
          delegated
          as="h3"
          magnitude="medium"
          className="font-[680] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] -tracking-[0.02em]"
        >
          {anchor?.tag ?? headlineFor({ isPending, isError })}
        </EditorialHeading>
      </div>

      <m.p
        variants={sectionChildVariants.body}
        style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
        className="max-w-prose text-pretty text-foreground/80 text-sm leading-relaxed sm:text-base"
      >
        {data === undefined || anchor === undefined
          ? proseFor({ isPending, isError })
          : `${Math.round(shareOf(leading) * 100)}% of your ${formatPlaytime(data.lifetime.distributedMinutes)} sit in ${joinGenres(leading)} — and ${anchor.tag} alone is ${anchor.gameCount} ${anchor.gameCount === 1 ? "game" : "games"} and ${formatPlaytime(anchor.minutes)} of it.`}
      </m.p>

      {leading.length > 0 && (
        <m.ul
          variants={sectionChildVariants.meta}
          style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
          className="flex flex-col gap-2"
        >
          {leading.map((genre) => (
            <GenreRow key={genre.tag} genre={genre} />
          ))}
        </m.ul>
      )}
    </m.div>
  );
}

function headlineFor({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return "Reading the shelf";
  if (isError) return "Unavailable";
  return "No genre yet";
}

function proseFor({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return "Weighing every played hour against the tags behind it…";
  if (isError) return "The genre fingerprint is unavailable right now.";
  return "No played game carries a genre tag yet — community tags arrive with the enrichment poller.";
}

// The bar is what makes the three comparable at a glance: the leading genre's
// share only means something next to the ones it beat.
function GenreRow({ genre }: { genre: GenreShare }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-foreground/80 sm:w-44">
        {genre.tag}
      </span>
      <span
        aria-hidden="true"
        className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-foreground/10"
      >
        <span
          className="block h-full rounded-full bg-foreground/40"
          style={{ width: `${Math.round(genre.share * 100)}%` }}
        />
      </span>
      <span className="w-28 shrink-0 text-right text-muted-foreground/80 text-xs tabular-nums">
        {Math.round(genre.share * 100)}% · {genre.gameCount}{" "}
        {genre.gameCount === 1 ? "game" : "games"}
      </span>
    </li>
  );
}
