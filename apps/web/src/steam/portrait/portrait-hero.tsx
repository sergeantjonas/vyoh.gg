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
import { StatRow } from "./stat-row";
import { useSteamPortrait } from "./use-portrait";

// The section's opening statement rather than the first of five equal tiles:
// one genre names the player, the sentence under it earns the name, and the
// rows under that let a reader disagree with both. Bare wrapper — the band is
// a magazine spread, so the chrome lives on the chips below it, not here.
//
// No eyebrow above the masthead. The design spec pairs one with every chapter
// headline, but those chapters own their whole screen; this band sits under a
// section header that already names it, so an eyebrow makes `Portrait` → `Genre
// anchor` → `Souls-like` three label layers deep before any content. Baseline-
// aligning it beside the masthead is worse still: it indents the one line the
// eye lands on, leaving it as the only element off the band's left margin.
export function PortraitHero() {
  const { data, isPending, isError } = useSteamPortrait();
  const reducedMotion = useReducedMotion();

  const leading = data === undefined ? [] : leadingGenres(data.lifetime.genres);
  const anchor = leading[0];

  return (
    <m.div
      className="flex flex-col gap-4"
      variants={
        reducedMotion ? sectionReducedContainerVariants : sectionContainerVariants
      }
      initial="hidden"
      animate="visible"
    >
      <EditorialHeading
        delegated
        as="h3"
        magnitude="medium"
        className="font-[680] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] -tracking-[0.02em]"
      >
        {anchor?.tag ?? headlineFor({ isPending, isError })}
      </EditorialHeading>

      <m.p
        variants={sectionChildVariants.body}
        style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
        className="text-pretty text-foreground/80 text-base leading-relaxed sm:text-lg"
      >
        {data === undefined || anchor === undefined
          ? proseFor({ isPending, isError })
          : `${Math.round(shareOf(leading) * 100)}% of your ${formatPlaytime(data.lifetime.distributedMinutes)} sit in ${joinGenres(leading)} — and ${anchor.tag} alone is ${anchor.gameCount} ${anchor.gameCount === 1 ? "game" : "games"} and ${formatPlaytime(anchor.minutes)} of it.`}
      </m.p>

      {leading.length > 0 && data !== undefined && (
        <m.ul
          variants={sectionChildVariants.meta}
          style={{ willChange: SECTION_CHILD_WILL_CHANGE }}
          className="flex flex-col gap-2"
        >
          {leading.map((genre) => (
            <GenreRow
              key={genre.tag}
              genre={genre}
              trackedMinutes={data.lifetime.distributedMinutes}
            />
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
function GenreRow({
  genre,
  trackedMinutes,
}: {
  genre: GenreShare;
  trackedMinutes: number;
}) {
  const games = `${genre.gameCount} ${genre.gameCount === 1 ? "game" : "games"}`;
  return (
    <StatRow
      label={genre.tag}
      fill={genre.share}
      trailing={`${Math.round(genre.share * 100)}% · ${games}`}
      tooltip={
        <>
          <p className="font-medium text-foreground">{genre.tag}</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {formatPlaytime(genre.minutes)} across {games}, out of{" "}
            {formatPlaytime(trackedMinutes)} that carry any genre.
          </p>
          {/* Playtime is split across a game's matched tags rather than repeated
              per tag, which is the only reason the shares can be added up. */}
          <p className="mt-1.5 text-muted-foreground/70 text-[0.6875rem] leading-relaxed">
            A game's hours are divided between its genres, not counted once per genre.
          </p>
        </>
      }
    />
  );
}
