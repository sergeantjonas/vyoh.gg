import { BadRequestException, type PipeTransform } from "@nestjs/common";

// `ParseIntPipe` only answers "is this an integer" — it has no range option, so
// every numeric query param in the api was unbounded. The values flow into
// Prisma `take`/`skip`, and a negative `take` is not an error to Prisma: it
// reads as "take the last N", silently reversing pagination rather than
// failing. That is the sharper edge here; an absurdly large value mostly just
// returns however many rows exist, since every one of these queries is already
// scoped to the owner's own data.
//
// Rejects rather than clamps, deliberately. These values size aggregation
// windows, so a silent clamp would answer with a *different* dataset than the
// caller asked for and the wrong number would look like a real result. A 400
// is visible the first time it happens.
export class BoundedIntPipe implements PipeTransform<unknown, number | undefined> {
  constructor(
    private readonly name: string,
    private readonly min: number,
    private readonly max: number,
    private readonly optional = false
  ) {}

  transform(value: unknown): number | undefined {
    if (this.optional && (value === undefined || value === "")) return undefined;
    // A repeated query param (`?count=1&count=2`) arrives as an array, so
    // reject anything that is not a lone scalar rather than coercing it.
    if (typeof value !== "string" && typeof value !== "number") {
      throw new BadRequestException(`${this.name} must be a single integer`);
    }
    // Match the digits explicitly rather than leaning on `Number()`, which is
    // far looser than it looks: it reads "" as 0 and "0x10" as 16, so a plain
    // `Number.isInteger` check would have accepted both.
    //
    // In the live chain this branch is mostly belt-and-braces, and it is worth
    // knowing why rather than re-deriving it: the global ValidationPipe runs
    // `transform: true` before any param-level pipe, so a query param typed
    // `number` is already coerced by the time it arrives here. Measured against
    // the running api — `?count=abc` reaches the handler as the DefaultValuePipe
    // default (20 rows back), and `?count=0x10` arrives as 16 (16 rows back).
    // So malformed input resolves to the default rather than a 400, while
    // out-of-range input still fails here, which is the half that matters. Keep
    // the strict parse anyway: it holds if the global pipe's config changes.
    const parsed =
      typeof value === "number"
        ? value
        : /^-?\d+$/.test(value)
          ? Number(value)
          : Number.NaN;
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`${this.name} must be an integer`);
    }
    if (parsed < this.min || parsed > this.max) {
      throw new BadRequestException(
        `${this.name} must be between ${this.min} and ${this.max}`
      );
    }
    return parsed;
  }
}

// The web asks for 2000 matches on three surfaces (the champion table, champion
// detail and the activity window), so the ceiling has to clear that with room
// to grow — a cap below it would not error, it would silently aggregate over a
// truncated window and report a confidently wrong number. It also sends
// `count=0` in two places, so the floor is 0 rather than 1.
export const COUNT_PIPE = new BoundedIntPipe("count", 0, 5000);
export const START_PIPE = new BoundedIntPipe("start", 0, 100_000);
export const LIMIT_PIPE = new BoundedIntPipe("limit", 0, 500);
// Riot's queue ids are small positive integers. Not an allowlist: the param
// filters matches by whatever queue they were played in, and new queues appear
// every season, so a closed set would reject legitimate values the moment Riot
// adds one. The bound exists to keep the key space of the match-id cache finite.
export const QUEUE_PIPE_OPTIONAL = new BoundedIntPipe("queue", 0, 10_000, true);
export const DAYS_PIPE_OPTIONAL = new BoundedIntPipe("days", 0, 3650, true);
