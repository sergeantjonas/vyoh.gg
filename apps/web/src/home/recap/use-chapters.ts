import {
  CHAPTER_COPY_OVERRIDES,
  DEV_LOL_MOMENT_OVERRIDE,
  PINNED_CHAPTER,
} from "@/home/landing-config";
import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type {
  LolMomentChapterDescriptor,
  RecapChapterDescriptor,
  RecapChaptersResponse,
} from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchChapters(): Promise<RecapChaptersResponse> {
  const res = await fetch(`${API_URL}/recap/chapters`);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<RecapChaptersResponse>;
}

/**
 * Apply the owner's `CHAPTER_COPY_OVERRIDES` overlay. The selector ships
 * `framing: null` for every descriptor; we layer the curator copy here so
 * the API can stay a pure ranker (no curator state) and so future arc
 * chunks that add fields can keep the per-slug overlay model. Exported for
 * direct testing — composes with the imported config in `useChapters`.
 */
export function applyChapterOverrides(
  chapter: RecapChapterDescriptor,
  overrides: Record<string, { eyebrow?: string; title?: string }>
): RecapChapterDescriptor {
  const override = overrides[chapter.slug];
  if (!override) return chapter;
  return { ...chapter, framing: { ...chapter.framing, ...override } };
}

/**
 * Apply `DEV_LOL_MOMENT_OVERRIDE`. Prepends a synthetic LoL-moment descriptor
 * to the chapter list when set — dev-only knob for reviewing the moment
 * chapter's visual layout in absence of a qualifying real candidate. Null
 * override is a no-op (production behavior). Exported for direct testing.
 */
export function applyDevLolMomentOverride(
  chapters: RecapChapterDescriptor[],
  override: LolMomentChapterDescriptor | null
): RecapChapterDescriptor[] {
  if (!override) return chapters;
  // Drop any descriptor whose slug collides with the override — keeps the
  // override authoritative if the detector happens to surface the same
  // moment naturally while the knob is set.
  const filtered = chapters.filter((c) => c.slug !== override.slug);
  return [override, ...filtered];
}

/**
 * Apply `PINNED_CHAPTER`. Moves the matched slug to the head of the list;
 * leaves the rest in algorithmic order. Silently no-ops if the configured
 * slug isn't in the response — pinning a stale slug shouldn't break the
 * page, just degrade to pure ranking.
 */
export function applyChapterPin(
  chapters: RecapChapterDescriptor[],
  pinnedSlug: string | null
): RecapChapterDescriptor[] {
  if (!pinnedSlug) return chapters;
  const idx = chapters.findIndex((c) => c.slug === pinnedSlug);
  if (idx <= 0) return chapters;
  const pinned = chapters[idx];
  if (!pinned) return chapters;
  return [pinned, ...chapters.slice(0, idx), ...chapters.slice(idx + 1)];
}

/**
 * Landing-page algorithmic chapter stream. Returns the chapters below the
 * (hardcoded, structural) Ahri anchor in `/`'s render tree. The Steam-
 * subject K=3 cap is enforced server-side; curator overrides (PINNED +
 * CHAPTER_COPY_OVERRIDES) are layered here so the API stays curation-
 * agnostic.
 *
 * Mirrors `useSteamGameRecap`'s 30-min stale-time — the underlying signal
 * is the daily owned-games poll + event-driven unlocks refresh, so a
 * per-interaction freshness sweep would just churn the cache.
 */
export function useChapters() {
  return useQuery({
    queryKey: ["recap", "chapters"],
    queryFn: fetchChapters,
    select: (data) =>
      applyDevLolMomentOverride(
        applyChapterPin(
          data.chapters.map((c) => applyChapterOverrides(c, CHAPTER_COPY_OVERRIDES)),
          PINNED_CHAPTER
        ),
        DEV_LOL_MOMENT_OVERRIDE
      ),
    staleTime: 30 * 60 * 1_000,
  });
}
