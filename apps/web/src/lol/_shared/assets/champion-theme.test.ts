import { describe, expect, it } from "vitest";
import { championTheme } from "./champion-theme";

describe("championTheme", () => {
  it("returns a {dominantHex, blurhash} pair shaped like a real entry for a known champion", () => {
    // Pull any entry from the JSON via a popular alias. Don't assert exact
    // values — those rebuild whenever the precompute runs — just the shape.
    const theme = championTheme("Ahri");
    expect(theme).toEqual({
      dominantHex: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      blurhash: expect.any(String),
    });
    expect(theme.blurhash.length).toBeGreaterThan(0);
  });

  it("strips the Swarm-mode 'Strawberry_' prefix before lookup", () => {
    // Strawberry_Akshan should resolve to Akshan's theme entry, not the fallback.
    expect(championTheme("Strawberry_Akshan")).toEqual(championTheme("Akshan"));
  });

  it("falls back to a neutral gray for unknown aliases", () => {
    const theme = championTheme("DefinitelyNotAChampion_2026");
    expect(theme.dominantHex).toBe("#888888");
    expect(theme.blurhash.length).toBeGreaterThan(0);
  });
});
