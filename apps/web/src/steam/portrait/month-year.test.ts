import { describe, expect, it } from "vitest";
import { MONTH_FORMAT, monthAndYear } from "./month-year";

describe("monthAndYear", () => {
  it("pins the zone rather than inheriting the process one", () => {
    // The assertion that matters: a container has no TZ, so an inherited zone
    // renders a different month on the two sides of hydration and React throws
    // the server tree away. Asserting the resolved option catches the pin being
    // dropped, which a value assertion cannot do while CI itself runs in UTC.
    expect(MONTH_FORMAT.resolvedOptions().timeZone).toBe("UTC");
  });

  it("reads a boundary instant as its UTC month, not a local one", () => {
    expect(monthAndYear("2012-07-31T23:30:00.000Z")).toBe("July 2012");
    expect(monthAndYear("2012-08-01T00:30:00.000Z")).toBe("August 2012");
  });

  it("names the month in full", () => {
    expect(monthAndYear("2012-07-17T00:00:00.000Z")).toBe("July 2012");
  });
});
