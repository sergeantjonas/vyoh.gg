import { itemIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
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

function buildItemsMap(bundle: LolStaticBundle, patch: string): Map<number, Item> {
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
  const patch = useDDragonVersion();
  return useLolStaticSelect((bundle) => buildItemsMap(bundle, patch));
}
