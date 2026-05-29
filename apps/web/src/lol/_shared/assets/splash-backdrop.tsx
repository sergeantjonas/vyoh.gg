import { BACKDROP_SHELL_CLASS, BackdropPortal } from "@/_shared/backdrop/backdrop-portal";
import { useThemeColor } from "@/lib/use-theme-color";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { AnimatePresence, m } from "motion/react";
import {
  type ReactNode,
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// The backdrop renderer pulls in the blurhash decode library and a chunk of
// Ken-Burns/Motion render code that nothing needs until the first champion is
// claimed. Keep the context eager (consumers call useSplashChampion()
// synchronously) but defer the layer itself behind React.lazy + Suspense.
const ChampionSplashLayer = lazy(() => import("./champion-splash-layer"));

type SplashClaim = { champion: string; offsetX: number };

type SplashContextValue = {
  setChampion: (owner: number, champion: string, offsetX?: number) => void;
  clearChampion: (owner: number) => void;
};

const SplashContext = createContext<SplashContextValue | null>(null);

// Owner ids are allocated at render time, so parents get lower numbers than
// their children. The provider displays the highest active owner id, which
// keeps the most-deeply-nested consumer in charge while their parent's
// claim acts as a fallback when the child unmounts.
let ownerSeq = 0;

export function SplashProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Map<number, SplashClaim>>(() => new Map());

  const setChampion = useCallback((owner: number, c: string, nextOffsetX = 0) => {
    setClaims((prev) => {
      const existing = prev.get(owner);
      if (existing && existing.champion === c && existing.offsetX === nextOffsetX) {
        return prev;
      }
      const next = new Map(prev);
      next.set(owner, { champion: c, offsetX: nextOffsetX });
      return next;
    });
  }, []);

  const clearChampion = useCallback((owner: number) => {
    setClaims((prev) => {
      if (!prev.has(owner)) return prev;
      const next = new Map(prev);
      next.delete(owner);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ setChampion, clearChampion }),
    [setChampion, clearChampion]
  );

  let topOwner = -1;
  let topClaim: SplashClaim | null = null;
  for (const [owner, claim] of claims) {
    if (owner > topOwner) {
      topOwner = owner;
      topClaim = claim;
    }
  }
  const champion = topClaim?.champion ?? null;
  const offsetX = topClaim?.offsetX ?? 0;

  // Drive the per-route theme color from the active backdrop champion. This
  // makes the theme cascade follow whatever champion is currently showing
  // (account overview's most-played, match-detail's hero, champion detail
  // page, etc.) instead of each route having to wire its own useThemeColor.
  useThemeColor(champion ? championTheme(champion).dominantHex : null);

  return (
    <SplashContext.Provider value={value}>
      {children}
      <BackdropPortal>
        <AnimatePresence>
          {champion && (
            <m.div
              key={champion}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className={BACKDROP_SHELL_CLASS}
            >
              <Suspense fallback={null}>
                <ChampionSplashLayer champion={champion} offsetX={offsetX} />
              </Suspense>
            </m.div>
          )}
        </AnimatePresence>
      </BackdropPortal>
    </SplashContext.Provider>
  );
}

const DEFAULT_OFFSET_X = 22;

export function useSplashChampion(
  champion: string | null | undefined,
  offsetX = DEFAULT_OFFSET_X
) {
  const ctx = useContext(SplashContext);
  if (!ctx) throw new Error("useSplashChampion must be used within SplashProvider");
  const ownerRef = useRef<number | null>(null);
  if (ownerRef.current === null) ownerRef.current = ++ownerSeq;

  useEffect(() => {
    const owner = ownerRef.current;
    if (owner === null) return;
    if (champion) ctx.setChampion(owner, champion, offsetX);
    else ctx.clearChampion(owner);
  }, [champion, offsetX, ctx]);

  useEffect(() => {
    const owner = ownerRef.current;
    return () => {
      if (owner !== null) ctx.clearChampion(owner);
    };
  }, [ctx]);
}
