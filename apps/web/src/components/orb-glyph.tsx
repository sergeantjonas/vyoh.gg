import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";

const ORB_SRC = "/vyoh-orb-mark.svg";

interface OrbGlyphProps {
  className?: string;
}

export function OrbGlyph({ className }: OrbGlyphProps) {
  const reducedMotion = useReducedMotion();

  return (
    <span
      className={cn("relative inline-block aspect-square align-middle", className)}
      aria-hidden="true"
    >
      <m.span
        // Aura derives from --theme-color so the orb's halo tints with
        // the per-route theme. The PNG inside <img> can't be recolored
        // without flattening its 3D shading, so the halo is where the
        // brand mark expresses the theme.
        className="absolute inset-[-25%] rounded-full bg-[radial-gradient(circle,oklch(from_var(--theme-color)_l_c_h_/_0.55)_0%,oklch(from_var(--theme-color)_l_c_h_/_0.2)_45%,oklch(from_var(--theme-color)_l_c_h_/_0)_70%)] blur-md mix-blend-screen"
        {...(!reducedMotion
          ? {
              animate: { opacity: [0.55, 0.9, 0.55] },
              transition: {
                duration: 4.6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }
          : {})}
      />
      {/* Orb silhouette: the SVG asset is used as a CSS mask so the fill
          becomes var(--theme-color). The PNG-inside-SVG body loses its
          3D shading by going through the mask, but at navbar size that
          detail wasn't readable anyway, and the theme statement is much
          stronger this way.                                              */}
      <span
        aria-hidden="true"
        className="relative block size-full bg-[var(--theme-color)] transition-colors duration-300"
        style={{
          maskImage: `url(${ORB_SRC})`,
          WebkitMaskImage: `url(${ORB_SRC})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          // Force alpha mode — the SVG wraps a raster PNG, and browser
          // defaults for `match-source` on this kind of compound source
          // have historically diverged. Without this, a browser picking
          // luminance mode would let the orb's 3D highlights/shadows
          // punch through the silhouette. Unprefixed `mask-mode` is
          // supported in Safari 15.4+ (the project's baseline).
          maskMode: "alpha",
        }}
      />
    </span>
  );
}
