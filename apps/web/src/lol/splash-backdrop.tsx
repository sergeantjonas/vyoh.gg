import { championCenteredSplashUrl } from "@/lib/champion-icon";
import { championTheme } from "@/lib/champion-theme";
import { AnimatePresence, m } from "motion/react";
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

type SplashContextValue = {
  setChampion: (owner: number, champion: string, offsetX?: number) => void;
  clearChampion: (owner: number) => void;
};

const SplashContext = createContext<SplashContextValue | null>(null);

let ownerSeq = 0;

function ChampionSplashLayer({
  champion,
  offsetX,
}: {
  champion: string;
  offsetX: number;
}) {
  const theme = championTheme(champion);
  const url = championCenteredSplashUrl(champion);
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
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
    </>
  );
}

export function SplashProvider({ children }: { children: ReactNode }) {
  const [champion, setChampionState] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const clearTimerRef = useRef<number | null>(null);
  const activeOwnerRef = useRef<number | null>(null);

  const setChampion = useCallback((owner: number, c: string, nextOffsetX = 0) => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    activeOwnerRef.current = owner;
    setChampionState(c);
    setOffsetX(nextOffsetX);
  }, []);

  const clearChampion = useCallback((owner: number) => {
    if (activeOwnerRef.current !== owner) return;
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      if (activeOwnerRef.current === owner) {
        activeOwnerRef.current = null;
        setChampionState(null);
      }
      clearTimerRef.current = null;
    }, 100);
  }, []);

  const value = useMemo(
    () => ({ setChampion, clearChampion }),
    [setChampion, clearChampion]
  );

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
    if (owner !== null && champion) {
      ctx.setChampion(owner, champion, offsetX);
      return () => ctx.clearChampion(owner);
    }
  }, [champion, offsetX, ctx]);
}
