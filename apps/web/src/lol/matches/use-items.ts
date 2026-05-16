import { itemIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useQuery } from "@tanstack/react-query";

const ITEMS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json";

interface RawItem {
  id: number;
  name: string;
  description?: string;
  priceTotal?: number;
  iconPath: string;
  from?: number[];
  categories?: string[];
}

export interface Item {
  name: string;
  description?: string;
  priceTotal?: number;
  iconUrl: string;
  from: number[];
  categories: string[];
}

async function fetchItems(patch: string): Promise<Map<number, Item>> {
  const res = await fetch(ITEMS_URL);
  if (!res.ok) throw new Error(`Failed to load items: HTTP ${res.status}`);
  const raw: RawItem[] = await res.json();
  return new Map(
    raw.map((it) => [
      it.id,
      {
        name: it.name,
        description: it.description,
        priceTotal: it.priceTotal,
        iconUrl: itemIconUrl(it.id, patch),
        from: it.from ?? [],
        categories: it.categories ?? [],
      },
    ])
  );
}

export function useItems() {
  const patch = useDDragonVersion();
  return useQuery({
    queryKey: ["lol", "items", patch],
    queryFn: () => fetchItems(patch),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
