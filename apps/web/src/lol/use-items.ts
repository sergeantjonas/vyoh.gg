import { useQuery } from "@tanstack/react-query";

const ITEMS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json";

interface RawItem {
  id: number;
  name: string;
  description?: string;
  priceTotal?: number;
}

export interface Item {
  name: string;
  description?: string;
  priceTotal?: number;
}

async function fetchItems(): Promise<Map<number, Item>> {
  const res = await fetch(ITEMS_URL);
  if (!res.ok) throw new Error(`Failed to load items: HTTP ${res.status}`);
  const raw: RawItem[] = await res.json();
  return new Map(
    raw.map((it) => [
      it.id,
      { name: it.name, description: it.description, priceTotal: it.priceTotal },
    ])
  );
}

export function useItems() {
  return useQuery({
    queryKey: ["lol", "items"],
    queryFn: fetchItems,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
