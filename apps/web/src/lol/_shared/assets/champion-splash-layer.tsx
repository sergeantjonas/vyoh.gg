import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { decode as decodeBlurhash } from "blurhash";
import { m, useIsPresent, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

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

// Heavy backdrop renderer — blurhash decode, Ken Burns drift, and the
// full-bleed splash image. Lazy-loaded by SplashProvider so the blurhash
// library and this module's render code stay out of the eager bundle until
// the first champion is actually claimed. Default-exported for React.lazy.
export default function ChampionSplashLayer({
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

  const patch = useDDragonVersion();
  const url = championBackdropSplashUrl(champion, patch);

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
              initial={{ opacity: 0 }}
              animate={{ opacity: imgReady ? 0.2 : 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ filter: "saturate(0.92) brightness(0.7)" }}
              className="absolute inset-0 size-full object-cover object-top"
            />
          </div>
        </m.div>
      </m.div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
    </>
  );
}
