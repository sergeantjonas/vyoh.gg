import type { LolAccount } from "@vyoh/shared";

// Slug → account, shared by the component hook and the route loaders that
// server-render LoL pages. Both have to agree on the match rule: a loader that
// resolved `Ahri` while the hook resolved `ahri` would prime a cache entry the
// component never reads, and the page would render its pending branch against a
// document that already had the data.
export function findAccountBySlug(
  accounts: readonly LolAccount[] | undefined,
  slug: string
): LolAccount | undefined {
  return accounts?.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
}
