import { useQuery } from "@tanstack/react-query";

const ITEMS_URL =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/items.json";

const ASSETS_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

// w=80 covers 2× retina for the largest display size (size-10 = 40 CSS px).
const ICON_WSRV_PARAMS = "&w=80&output=webp&q=85";

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

function iconUrlFromPath(path: string): string {
  const rawUrl = ASSETS_BASE + path.replace("/lol-game-data/assets/", "/").toLowerCase();
  const src = rawUrl.replace("https://", "");
  return `https://wsrv.nl/?url=${src}${ICON_WSRV_PARAMS}`;
}

async function fetchItems(): Promise<Map<number, Item>> {
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
        iconUrl: iconUrlFromPath(it.iconPath),
        from: it.from ?? [],
        categories: it.categories ?? [],
      },
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
