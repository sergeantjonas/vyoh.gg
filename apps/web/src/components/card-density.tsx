import { type ReactNode, createContext, useContext } from "react";

export type CardDensity = "comfortable" | "compact";

// Density is a property of the band a card sits in, not of the card. A section
// that lays eleven facts out as chips wants all eleven compact; the same card
// components rendered one-per-row on a panel want the roomy recipe. Threading a
// prop would mean every intermediate card component accepting and forwarding
// one — the shape `frosted` already has, and eleven call sites of it is enough.
const CardDensityContext = createContext<CardDensity>("comfortable");

export function CardDensityProvider({
  value,
  children,
}: {
  value: CardDensity;
  children: ReactNode;
}) {
  return (
    <CardDensityContext.Provider value={value}>{children}</CardDensityContext.Provider>
  );
}

export function useCardDensity(): CardDensity {
  return useContext(CardDensityContext);
}
