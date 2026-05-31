import { useEffect, useRef } from "react";
import { type GradientLayer, VIGNETTE_MASK } from "./ambient-hero";

const DRIFT_PERIOD_MS = 60_000;
const DRIFT_AMPLITUDE = 0.05;
const FRAME_BUDGET_MS = 33;
const RADIUS_REFERENCE_PX = 1600;

function layerColor(layer: GradientLayer, alpha: number): string {
  const [L, C, H] = layer.lch;
  return `oklch(${L} ${C} ${H} / ${alpha})`;
}

interface Props {
  layers: readonly GradientLayer[];
}

export default function AmbientHeroCanvas({ layers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let lastFrame = 0;
    let cssWidth = 0;
    let cssHeight = 0;
    let visible = document.visibilityState === "visible";
    let mounted = true;
    const startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
      canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      if (!mounted) return;
      if (cssWidth > 0 && now - lastFrame >= FRAME_BUDGET_MS) {
        lastFrame = now;
        const t = now - startTime;
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.globalCompositeOperation = "screen";
        for (const layer of layers) {
          const cycle = (t / DRIFT_PERIOD_MS) * Math.PI * 2;
          const driftX = Math.sin(cycle + layer.phase) * DRIFT_AMPLITUDE;
          const driftY = Math.cos(cycle * 0.77 + layer.phase * 1.3) * DRIFT_AMPLITUDE;
          const cx = (layer.cx + driftX) * cssWidth;
          const cy = (layer.cy + driftY) * cssHeight;
          const r = layer.radius * (cssWidth / RADIUS_REFERENCE_PX);
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0, layerColor(layer, layer.alpha));
          grad.addColorStop(0.7, layerColor(layer, 0));
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cssWidth, cssHeight);
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (visible && mounted) {
        rafId = requestAnimationFrame(draw);
      }
    };

    const handleVisibility = () => {
      const nowVisible = document.visibilityState === "visible";
      if (nowVisible && !visible) {
        visible = true;
        lastFrame = 0;
        rafId = requestAnimationFrame(draw);
      } else if (!nowVisible && visible) {
        visible = false;
        cancelAnimationFrame(rafId);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    if (visible) rafId = requestAnimationFrame(draw);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [layers]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-ambient-canvas
      className="absolute inset-0 h-full w-full"
      style={{
        maskImage: VIGNETTE_MASK,
        WebkitMaskImage: VIGNETTE_MASK,
      }}
    />
  );
}
