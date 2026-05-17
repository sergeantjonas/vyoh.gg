export function excludeRemakes<T extends { remake: boolean }>(
  matches: readonly T[]
): T[] {
  return matches.filter((m) => !m.remake);
}
