export type PersonalRecordDirection = "higher-better" | "lower-better";

export function isPersonalRecord(
  prior: number | undefined,
  next: number,
  direction: PersonalRecordDirection
): boolean {
  if (prior === undefined) return false;
  if (Number.isNaN(prior) || Number.isNaN(next)) return false;
  if (direction === "higher-better") return next > prior;
  return next < prior;
}
