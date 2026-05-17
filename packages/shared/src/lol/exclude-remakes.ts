export function excludeRemakes<T extends { remake: boolean }>(matches: T[]): T[] {
  return matches.filter((m) => !m.remake);
}
