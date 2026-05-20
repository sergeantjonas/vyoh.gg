import { Controller, Get, Param, Query } from "@nestjs/common";
import type {
  CurrentPatchChangesResponse,
  PatchChangesResponse,
  PatchListEntry,
} from "@vyoh/shared";
import { PatchService } from "./patch.service";

// Hard cap to keep the IN-clause and JSON payload small. The PN2 profile
// heads-up requests top-5; the future PN3 patch-notes tab will request all
// changes by passing no champion filter at all, not a long list.
const MAX_CHAMPIONS = 20;

@Controller("lol/patches")
export class PatchController {
  constructor(private readonly patch: PatchService) {}

  // GET /lol/patches → newest-first list for the PN3 selector. Declaration
  // order matters here: a more permissive `@Get(":version")` route would
  // shadow this if added later, so keep the bare `@Get()` first.
  @Get()
  async listPatches(): Promise<PatchListEntry[]> {
    return this.patch.listPatches();
  }

  // GET /lol/patches/ranked-emblem-year → integer year string for the wiki
  // ranked emblem set the client should reference. Declared before any
  // `:version` matcher so the literal segment wins routing.
  @Get("ranked-emblem-year")
  async getRankedEmblemYear(): Promise<{ year: number }> {
    return { year: await this.patch.getRankedEmblemYear() };
  }

  // GET /lol/patches/current/changes?champion=Ahri&champion=Wukong
  // Repeated `champion` query params; Nest decodes single → string, multiple
  // → string[]. With no `champion` param the response carries the patch
  // version + an empty changes array (used by PN3 to confirm "what patch
  // are we showing" before fetching the full slate).
  //
  // Declared before `:version/changes` below so the literal "current" wins
  // route matching — Nest/Express resolves in registration order.
  @Get("current/changes")
  async getCurrentChanges(
    @Query("champion") champion?: string | string[]
  ): Promise<CurrentPatchChangesResponse> {
    const champions = normalizeChampions(champion);
    return this.patch.getCurrentChanges(champions);
  }

  // GET /lol/patches/26.10/changes → entire patch's changes, partitioned
  // into champions/items/runes (PN4). Powers the PN3+PN4 patch-notes tab,
  // which renders each section as its own block and sorts champion entries
  // client-side by the caller's play count.
  @Get(":version/changes")
  async getChangesForVersion(
    @Param("version") version: string
  ): Promise<PatchChangesResponse> {
    return this.patch.getChangesForVersion(version);
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
