import { itemIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import type { LolStaticBundle } from "@vyoh/shared";

export interface Item {
  name: string;
  description?: string | undefined;
  priceTotal?: number | undefined;
  iconUrl: string;
  from: number[];
  categories: string[];
}

function buildItemsMap(bundle: LolStaticBundle): Map<number, Item> {
  const patch = bundle.patchVersion ?? "16.9.1";
  return new Map(
    bundle.items.map((it) => {
      const from = it.recipe
        .map((r) => Number.parseInt(r, 10))
        .filter((n) => Number.isFinite(n));
      const item: Item = {
        name: it.name,
        iconUrl: itemIconUrl(it.id, patch),
        from,
        categories: it.categories,
      };
      const description = it.descriptionHtml ?? it.descriptionWikitext;
      if (description != null) item.description = description;
      if (it.priceTotal != null) item.priceTotal = it.priceTotal;
      return [it.id, item];
    })
  );
}

export function useItems() {
  return useLolStaticSelect(buildItemsMap);
}
