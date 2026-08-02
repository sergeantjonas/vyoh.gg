import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import {
  type BounceRate,
  bounceRates,
  bounceShare,
  describeBounce,
} from "./bounce-rates";
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
      emptyLabel="Nothing abandoned carries a genre the rest of the library shares."
      emptyPrescription="A bounce rate needs at least two games in the genre to mean anything."
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
    <ul className="flex flex-col gap-1.5 text-xs">
      {rates.map((rate) => (
        <li key={rate.tag} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-foreground/70">{rate.tag}</span>
          <span
            aria-hidden="true"
            className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10"
          >
            <span
              className="block h-full rounded-full bg-foreground/40"
              style={{ width: `${bounceShare(rate) * 100}%` }}
            />
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground/80">
            {rate.bounced}/{rate.tried}
          </span>
        </li>
      ))}
    </ul>
  );
}
