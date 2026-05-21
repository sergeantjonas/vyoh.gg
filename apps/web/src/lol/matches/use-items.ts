import { itemIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { toRichDescription } from "@/lol/_shared/static/rich-description";
import { useLolStaticSelect } from "@/lol/_shared/static/use-lol-static";
import { type LolStaticBundle, stripWikitext } from "@vyoh/shared";

export interface Item {
  name: string;
  // Plain-text fallback. Wiki templates resolved via `stripWikitext`. Safe
  // to render as text — used when no rich HTML is available.
  description?: string | undefined;
  // Sanitized wiki `action=parse` HTML with inline `<img>` srcs rewritten to
  // the image proxy. Render via `dangerouslySetInnerHTML`. Undefined when the
  // bundle row carried no HTML, or the sanitiser stripped it to nothing.
  descriptionRich?: string | undefined;
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
      const rawDescription = it.descriptionHtml ?? it.descriptionWikitext;
      if (rawDescription != null) item.description = stripWikitext(rawDescription);
      const rich = toRichDescription(it.descriptionHtml);
      if (rich) item.descriptionRich = rich;
      if (it.priceTotal != null) item.priceTotal = it.priceTotal;
      return [it.id, item];
    })
  );
}

export function useItems() {
  const patch = useDDragonVersion();
  return useLolStaticSelect((bundle) => buildItemsMap(bundle, patch));
}
