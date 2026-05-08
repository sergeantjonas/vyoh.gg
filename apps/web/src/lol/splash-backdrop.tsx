import { championCenteredSplashUrl } from "@/lib/champion-icon";
import { championTheme } from "@/lib/champion-theme";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
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
import { Blurhash } from "react-blurhash";
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

function ChampionSplashLayer({
  champion,
  offsetX,
}: {
  champion: string;
  offsetX: number;
}) {
  const theme = championTheme(champion);
  const url = championCenteredSplashUrl(champion);
  const reduced = useReducedMotion();
  const drift = useMemo(() => kenBurnsDrift(champion), [champion]);
  const [imgReady, setImgReady] = useState(false);

  useEffect(() => {
    setImgReady(false);
    let cancelled = false;
    const img = new Image();
    img.src = url;
    const apply = () => {
      if (!cancelled) setImgReady(true);
    };
    img.decode().then(apply, apply);
    return () => {
      cancelled = true;
    };
  }, [url]);

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
            reduced
              ? { scale: 1, x: "0%", y: "0%" }
              : { scale: 1.13, x: `${drift.x}%`, y: `${drift.y}%` }
          }
          transition={{
            duration: 18,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
          }}
          className="absolute inset-0"
        >
          <div
            style={{
              maskImage: "linear-gradient(to right, transparent, black 10%)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 10%)",
            }}
            className="absolute -top-[4%] -left-[4%] w-[108%] h-[108%]"
          >
            <Blurhash
              hash={theme.blurhash}
              width="100%"
              height="100%"
              resolutionX={32}
              resolutionY={32}
              punch={1}
              style={{ opacity: 0.35 }}
            />
            <m.img
              src={url}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              initial={{ opacity: 0 }}
              animate={{ opacity: imgReady ? 0.2 : 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ filter: "blur(5px) saturate(0.92) brightness(0.7)" }}
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
