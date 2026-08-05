import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Link } from "@tanstack/react-router";
import { type SteamPortraitSleeping, formatPlaytime } from "@vyoh/shared";

import { useSteamPortrait } from "./use-portrait";

const TITLE = "Sleeping on this genre";

export function SleepingGenreCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Looking for a queue…"
      errorLabel="The sleeping genres are unavailable right now."
      emptyLabel="No genre you play has more than one game waiting in it."
      emptyPrescription="A single untouched title is a recommendation, not a pattern — that one is the card beside this."
      isEmpty={(data) => data.backlog.sleeping === null}
    >
      {({ backlog, lifetime }) => {
        const sleeping = backlog.sleeping;
        if (sleeping === null) return null;
        // The hours mean nothing without the shelf they came off: 706h could be
        // one obsession or sixteen games, and which one it is decides whether
        // eleven more waiting reads as a queue or as a hoard.
        const played = lifetime.genres.find((genre) => genre.tag === sleeping.tag);

        return (
          <FactCard
            title={TITLE}
            // No count indicator: the verdict already says how many are
            // waiting, and a 275 px chip repeating its own number spends the
            // title's width to say nothing.
            // Untouched count first, played count second. The Portrait hero
            // already states the anchor genre's hours and carriers, and the
            // sleeping genre is usually that same anchor — leading with the
            // hours would restate the masthead two bands later. The ratio is
            // this card's own claim either way.
            verdict={
              played === undefined
                ? `${sleeping.untouchedCount} ${sleeping.tag} games you've never launched, against ${formatPlaytime(sleeping.minutes)} already in the genre.`
                : `${sleeping.untouchedCount} ${sleeping.tag} games you've never launched, against ${played.gameCount} you've put ${formatPlaytime(sleeping.minutes)} into.`
            }
            // Both halves of the ranking are worth stating: by queue length
            // alone this card would always name an umbrella tag every bundle
            // carries, which is the opposite of a genre worth waking.
            prescription="Ranked by how much of the portrait is waiting here, not by how long the queue is."
            evidence={<SleepingList sleeping={sleeping} />}
          />
        );
      }}
    </FactCardData>
  );
}

// The pick-up-next card is drawn from the same pool and usually holds the
// strongest match in the strongest genre, so it is kept out of this list — but
// not out of the count above it, which is why the two can disagree by one.
function SleepingList({ sleeping }: { sleeping: SteamPortraitSleeping }) {
  const unnamed = sleeping.untouchedCount - sleeping.games.length;

  return (
    <ul className="flex flex-col gap-1 text-muted-foreground/80 text-xs">
      {sleeping.games.map((game) => (
        <li key={game.appid}>
          <Link
            to="/steam/library/$appid"
            params={{ appid: String(game.appid) }}
            className="truncate text-foreground/70 underline-offset-2 hover:underline"
          >
            {game.name}
          </Link>
        </li>
      ))}
      {unnamed > 0 && <li className="text-muted-foreground/60">+{unnamed} more</li>}
    </ul>
  );
}
