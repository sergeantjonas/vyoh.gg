import { useLolStatic } from "@/lol/_shared/static/use-lol-static";

// Thin re-export over the bundled `/lol/static` patchVersion. Kept as its own
// hook so the ~13 call sites that need a patch string as an image cache key
// don't have to know about the bundle shape. Fallback applies during the
// brief cold-load window before the bundle resolves; the API image proxy
// tolerates any string here and resolves to the latest available asset.
export function useDDragonVersion(): string {
  const { data } = useLolStatic();
  return data?.patchVersion ?? "16.9.1";
}
