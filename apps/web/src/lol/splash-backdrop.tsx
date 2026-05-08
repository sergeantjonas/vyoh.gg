import {
  championBackdropSplashUrl,
  championCenteredSplashUrl,
} from "@/lib/champion-icon";
import { championTheme } from "@/lib/champion-theme";
import { decode as decodeBlurhash } from "blurhash";
import { AnimatePresence, m, useIsPresent, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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

// Stable per-champion pan direction so each splash drifts its own way
// instead of every backdrop sliding in the same arc.
function kenBurnsDrift(champion: string) {
  let h = 2166136261;
  for (let i = 0; i < champion.length; i++) {
    h = Math.imul(h ^ champion.charCodeAt(i), 16777619) >>> 0;
  }
  const angle = (h / 0xffffffff) * Math.PI * 2;
  const magnitude = 3;
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude };
}

// One decode per blurhash, cached as a 32×32 data URL. The previous
// react-blurhash <canvas> repainted on every mount; here we paint once and
// reuse the same image element for every subsequent visit to the champion.
const blurhashCache = new Map<string, string>();
function blurhashToDataUrl(hash: string): string {
  const cached = blurhashCache.get(hash);
  if (cached) return cached;
  if (typeof document === "undefined") return "";
  try {
    const pixels = decodeBlurhash(hash, 32, 32, 1);
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const imageData = ctx.createImageData(32, 32);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    const url = canvas.toDataURL();
    blurhashCache.set(hash, url);
    return url;
  } catch {
    return "";
  }
}

function ChampionSplashLayer({
  champion,
  offsetX,
}: {
  champion: string;
  offsetX: number;
}) {
  const theme = championTheme(champion);
  const reduced = useReducedMotion();
  const isPresent = useIsPresent();
  const drift = useMemo(() => kenBurnsDrift(champion), [champion]);
  const blurhashUrl = useMemo(() => blurhashToDataUrl(theme.blurhash), [theme.blurhash]);
  const [imgReady, setImgReady] = useState(false);

  // Source the pre-blurred WebP from wsrv.nl; if it ever fails we fall back
  // to the direct CDragon splash with the original CSS `filter: blur(5px)`
  // restored — same look, just paying the live-blur compositor cost again.
  const [erroredChampion, setErroredChampion] = useState<string | null>(null);
  const fallback = erroredChampion === champion;
  const url = fallback
    ? championCenteredSplashUrl(champion)
    : championBackdropSplashUrl(champion);
  const imgFilter = fallback
    ? "blur(5px) saturate(0.92) brightness(0.7)"
    : "saturate(0.92) brightness(0.7)";

  // While the layer is exiting, settle the Ken Burns transform back to
  // neutral over the same 0.7s as the parent opacity fade. Stops the
  // infinite repeat from running compositor work after the layer is gone.
  const loopActive = !reduced && isPresent;

  return (
    <>
      <m.div
        initial={false}
        animate={{ x: `${offsetX}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <m.div
          initial={{ scale: 1, x: "0%", y: "0%" }}
          animate={
            loopActive
              ? { scale: 1.13, x: `${drift.x}%`, y: `${drift.y}%` }
              : { scale: 1, x: "0%", y: "0%" }
          }
          transition={
            loopActive
              ? {
                  duration: 18,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                }
              : { duration: 0.7, ease: "easeOut" }
          }
          className="absolute inset-0"
        >
          <div
            style={{
              maskImage: "linear-gradient(to right, transparent, black 10%)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 10%)",
            }}
            className="absolute -top-[4%] -left-[4%] w-[108%] h-[108%]"
          >
            {blurhashUrl && (
              <img
                src={blurhashUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full object-cover"
                style={{ opacity: 0.35 }}
              />
            )}
            <m.img
              src={url}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              fetchPriority="low"
              onLoad={() => setImgReady(true)}
              onError={() => setErroredChampion(champion)}
              initial={{ opacity: 0 }}
              animate={{ opacity: imgReady ? 0.2 : 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ filter: imgFilter }}
              className="absolute inset-0 size-full object-cover object-top"
            />
          </div>
        </m.div>
      </m.div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
    </>
  );
}

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

  return (
    <SplashContext.Provider value={value}>
      {children}
      {createPortal(
        <AnimatePresence>
          {champion && (
            <m.div
              key={champion}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            >
              <ChampionSplashLayer champion={champion} offsetX={offsetX} />
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
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
