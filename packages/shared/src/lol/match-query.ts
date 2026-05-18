export type MatchOutcomeFilter = "win" | "loss" | null;

export type ParsedMatchQuery = {
  withChampions: string[];
  vsChampions: string[];
  outcome: MatchOutcomeFilter;
  queues: string[];
  roles: string[];
  patches: string[];
  duos: string[];
  since: Date | null;
  until: Date | null;
  kdaGt: number | null;
  kdaLt: number | null;
  freeText: string;
};

const EMPTY_QUERY: ParsedMatchQuery = {
  withChampions: [],
  vsChampions: [],
  outcome: null,
  queues: [],
  roles: [],
  patches: [],
  duos: [],
  since: null,
  until: null,
  kdaGt: null,
  kdaLt: null,
  freeText: "",
};

// Relative date tokens: "7d", "24h", "2w". Returns ms offset from `now`,
// or null if the value can't be parsed.
function parseRelativeOffsetMs(value: string): number | null {
  const match = value.match(/^(\d+)(h|d|w)$/);
  if (!match) return null;
  const [, rawAmount, unit] = match;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ms =
    unit === "h"
      ? amount * 60 * 60 * 1000
      : unit === "d"
        ? amount * 24 * 60 * 60 * 1000
        : amount * 7 * 24 * 60 * 60 * 1000;
  return ms;
}

// Accepts "7d" / "24h" / "2w" (relative to `now`) or ISO "YYYY-MM-DD".
// Returns null when neither form parses.
function parseDateBound(value: string, now: number): Date | null {
  const relativeMs = parseRelativeOffsetMs(value);
  if (relativeMs !== null) return new Date(now - relativeMs);
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function parseMatchQuery(
  input: string,
  now: number = Date.now()
): ParsedMatchQuery {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return EMPTY_QUERY;

  const withChampions: string[] = [];
  const vsChampions: string[] = [];
  const queues: string[] = [];
  const roles: string[] = [];
  const patches: string[] = [];
  const duos: string[] = [];
  let outcome: MatchOutcomeFilter = null;
  let since: Date | null = null;
  let until: Date | null = null;
  let kdaGt: number | null = null;
  let kdaLt: number | null = null;
  const freeTokens: string[] = [];

  for (const token of tokens) {
    if (token === "wins") {
      outcome = "win";
      continue;
    }
    if (token === "losses") {
      outcome = "loss";
      continue;
    }
    if (token.startsWith("with:")) {
      const value = token.slice("with:".length);
      if (value) withChampions.push(value);
      continue;
    }
    if (token.startsWith("vs:")) {
      const value = token.slice("vs:".length);
      if (value) vsChampions.push(value);
      continue;
    }
    if (token.startsWith("queue:")) {
      const value = token.slice("queue:".length);
      if (value) queues.push(value);
      continue;
    }
    if (token.startsWith("role:")) {
      const value = token.slice("role:".length);
      if (value) roles.push(value);
      continue;
    }
    if (token.startsWith("patch:")) {
      const value = token.slice("patch:".length);
      if (value) patches.push(value);
      continue;
    }
    if (token.startsWith("duo:")) {
      const value = token.slice("duo:".length);
      if (value) duos.push(value);
      continue;
    }
    if (token.startsWith("since:")) {
      const value = token.slice("since:".length);
      if (value) {
        const parsed = parseDateBound(value, now);
        if (parsed) since = parsed;
      }
      continue;
    }
    if (token.startsWith("until:")) {
      const value = token.slice("until:".length);
      if (value) {
        const parsed = parseDateBound(value, now);
        if (parsed) until = parsed;
      }
      continue;
    }
    if (token.startsWith("kda>")) {
      const raw = token.slice("kda>".length);
      if (raw) {
        const value = Number(raw);
        if (Number.isFinite(value)) kdaGt = value;
      }
      continue;
    }
    if (token.startsWith("kda<")) {
      const raw = token.slice("kda<".length);
      if (raw) {
        const value = Number(raw);
        if (Number.isFinite(value)) kdaLt = value;
      }
      continue;
    }
    freeTokens.push(token);
  }

  return {
    withChampions,
    vsChampions,
    outcome,
    queues,
    roles,
    patches,
    duos,
    since,
    until,
    kdaGt,
    kdaLt,
    freeText: freeTokens.join(" "),
  };
}
