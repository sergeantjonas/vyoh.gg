import { championSplashUrl } from "@/lib/champion-icon";
import { AnimatePresence, m, useMotionValue, useSpring } from "motion/react";
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

type SplashContextValue = {
  setChampion: (champion: string | null) => void;
};

const SplashContext = createContext<SplashContextValue | null>(null);

export function SplashProvider({ children }: { children: ReactNode }) {
  const [champion, setChampionState] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(mouseX, { stiffness: 60, damping: 20, mass: 0.6 });
  const parallaxY = useSpring(mouseY, { stiffness: 60, damping: 20, mass: 0.6 });

  const setChampion = useCallback((c: string | null) => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (c === null) {
      clearTimerRef.current = window.setTimeout(() => {
        setChampionState(null);
        clearTimerRef.current = null;
      }, 100);
      return;
    }
    setChampionState(c);
  }, []);

  useEffect(() => {
    if (!champion) {
      setSrc(null);
      return;
    }
    const url = championSplashUrl(champion);
    if (url === src) return;
    let cancelled = false;
    const img = new Image();
    img.src = url;
    const apply = () => {
      if (!cancelled) setSrc(url);
    };
    img.decode().then(apply, apply);
    return () => {
      cancelled = true;
    };
  }, [champion, src]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      mouseX.set(-nx * 24);
      mouseY.set(-ny * 16);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  const value = useMemo(() => ({ setChampion }), [setChampion]);

  return (
    <SplashContext.Provider value={value}>
      {children}
      {createPortal(
        <AnimatePresence>
          {src && (
            <m.div
              key={src}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            >
              <m.img
                src={src}
                alt=""
                aria-hidden="true"
                style={{ x: parallaxX, y: parallaxY }}
                className="absolute -inset-[3%] size-[106%] object-cover opacity-25"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
            </m.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </SplashContext.Provider>
  );
}

export function useSplashChampion(champion: string | null | undefined) {
  const ctx = useContext(SplashContext);
  if (!ctx) throw new Error("useSplashChampion must be used within SplashProvider");
  useEffect(() => {
    if (champion) {
      ctx.setChampion(champion);
      return () => ctx.setChampion(null);
    }
  }, [champion, ctx]);
}
