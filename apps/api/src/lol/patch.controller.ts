import { Controller, Get, Query } from "@nestjs/common";
import type { CurrentPatchChangesResponse } from "@vyoh/shared";
import { PatchService } from "./patch.service";

// Hard cap to keep the IN-clause and JSON payload small. The PN2 profile
// heads-up requests top-5; the future PN3 patch-notes tab will request all
// changes by passing no champion filter at all, not a long list.
const MAX_CHAMPIONS = 20;

@Controller("lol/patches")
export class PatchController {
  constructor(private readonly patch: PatchService) {}

  // GET /lol/patches/current/changes?champion=Ahri&champion=Wukong
  // Repeated `champion` query params; Nest decodes single → string, multiple
  // → string[]. With no `champion` param the response carries the patch
  // version + an empty changes array (used by PN3 to confirm "what patch
  // are we showing" before fetching the full slate).
  @Get("current/changes")
  async getCurrentChanges(
    @Query("champion") champion?: string | string[]
  ): Promise<CurrentPatchChangesResponse> {
    const champions = normalizeChampions(champion);
    return this.patch.getCurrentChanges(champions);
  }
}

export function normalizeChampions(input: string | string[] | undefined): string[] {
  if (input === undefined) return [];
  const list = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_CHAMPIONS) break;
  }
  return out;
}
