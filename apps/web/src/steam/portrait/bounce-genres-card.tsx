import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import {
  type BounceRate,
  bounceRates,
  bounceShare,
  describeBounce,
} from "./bounce-rates";
import { ExampleGames, StatRow } from "./stat-row";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Genres you bounce off";

export function BounceGenresCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading what didn't stick…"
      errorLabel="The bounce rates are unavailable right now."
      emptyLabel="No genre has been abandoned often enough to call it a pattern."
      emptyPrescription="One dropped game is a true rate and still an anecdote, so a genre needs at least two."
      isEmpty={(data) =>
        bounceRates(data.anti.tasted.fingerprint, data.lifetime).length === 0
      }
    >
      {({ anti, lifetime }) => {
        const rates = bounceRates(anti.tasted.fingerprint, lifetime);
        const worst = rates[0];
        if (worst === undefined) return null;

        return (
          <FactCard
            title={TITLE}
            // The abandoned games carrying any genre at all — the population
            // every rate below is computed over, matching the sibling cards'
            // count-not-rate indicator.
            metric={anti.tasted.fingerprint.gamesCounted}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={`You've opened ${worst.tried} ${worst.tag} games and given up on ${describeBounce(worst)}.`}
            evidence={<BounceList rates={rates} />}
          />
        );
      }}
    </FactCardData>
  );
}

// The bar is the claim: a genre bounced 2-of-2 reads as a wall where the same
// two games at 2-of-16 read as a rounding error, and the number alone hides it.
function BounceList({ rates }: { rates: BounceRate[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rates.map((rate) => (
        <StatRow
          key={rate.tag}
          size="chip"
          label={rate.tag}
          fill={bounceShare(rate)}
          trailing={`${rate.bounced}/${rate.tried}`}
          tooltip={
            <>
              <p className="font-medium text-foreground">{rate.tag}</p>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                {rate.tried} opened, {rate.bounced} dropped inside the hour —{" "}
                {Math.round(bounceShare(rate) * 100)}%.{" "}
                {rate.tried - rate.bounced === 0
                  ? "None of them stuck."
                  : `${rate.tried - rate.bounced} stuck.`}
              </p>
              <ExampleGames
                examples={rate.dropped}
                trailing={rate.bounced - rate.dropped.length}
              />
            </>
          }
        />
      ))}
    </ul>
  );
}
