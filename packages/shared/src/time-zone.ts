/**
 * The zone every owner-local reading in this app is expressed in.
 *
 * Two distinct jobs depend on it. Bucketing (chronotype hours, daily streak
 * boundaries, "today") is owner-local by definition — a match played at 01:00
 * Brussels belongs to that night, not to whatever calendar day UTC says. And
 * display formatting has to name a zone explicitly or `Intl` resolves to the
 * host's, which differs between a UTC container and a visitor's browser and
 * makes React discard the server-rendered tree.
 *
 * Pin `timeZone: "UTC"` instead wherever the value is a date-only concept
 * handed to us by an upstream (patch release dates, Steam release dates).
 * Those carry no time-of-day, so re-projecting them into a zone can only shift
 * them off by a day.
 */
export const OWNER_TIME_ZONE = "Europe/Brussels";
