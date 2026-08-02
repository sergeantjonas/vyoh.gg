import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import type { GenreShare } from "@vyoh/shared";
import { formatPlaytime } from "@vyoh/shared";
import { joinGenres, leadingGenres, shareOf } from "./leading-genres";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Genre anchor";

export function GenreAnchorCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the genre fingerprint…"
      errorLabel="The genre fingerprint is unavailable right now."
      emptyLabel="No played game carries a genre tag yet."
      emptyPrescription="Community tags arrive with the enrichment poller."
      isEmpty={(data) => data.lifetime.genres.length === 0}
    >
      {({ lifetime }) => {
        const leading = leadingGenres(lifetime.genres);
        const anchor = leading[0];

        return (
          <FactCard
            title={TITLE}
            metric={lifetime.gamesCounted}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={`${Math.round(shareOf(leading) * 100)}% of your ${formatPlaytime(lifetime.distributedMinutes)} sit in ${joinGenres(leading)}.`}
            prescription={
              anchor === undefined
                ? undefined
                : `${anchor.tag} alone is ${anchor.gameCount} ${anchor.gameCount === 1 ? "game" : "games"} and ${formatPlaytime(anchor.minutes)}.`
            }
            evidence={<GenreEvidence genres={leading} />}
          />
        );
      }}
    </FactCardData>
  );
}

// Each named genre with the two numbers that let a reader disagree with the
// claim: what fraction it holds, and how many games carry it.
function GenreEvidence({ genres }: { genres: GenreShare[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground/80 text-xs">
      {genres.map((genre) => (
        <li key={genre.tag} className="tabular-nums">
          <span className="text-foreground/70">{genre.tag}</span>{" "}
          {Math.round(genre.share * 100)}% · {genre.gameCount}{" "}
          {genre.gameCount === 1 ? "game" : "games"}
        </li>
      ))}
    </ul>
  );
}
