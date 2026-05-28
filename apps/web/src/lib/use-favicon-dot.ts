import { useQueryClient } from "@tanstack/react-query";
import type { LiveMatch, SteamPlayerState } from "@vyoh/shared";
import { useEffect, useRef } from "react";

const FAVICON_DEFAULT = "/vyoh-orb-favicon.svg";
// Badge position in the bottom-right of a 64×64 canvas.
const SIZE = 64;
const DOT_R = 9;
const DOT_X = SIZE - DOT_R - 3;
const DOT_Y = SIZE - DOT_R - 3;

// Cached so the second badge draw is synchronous.
let cachedOrb: HTMLImageElement | null = null;

function loadOrb(): Promise<HTMLImageElement> {
  if (cachedOrb?.complete) return Promise.resolve(cachedOrb);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedOrb = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = FAVICON_DEFAULT;
  });
}

async function buildBadgedFavicon(fill: string, glow: string): Promise<string> {
  const img = await loadOrb();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return FAVICON_DEFAULT;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  // Soft glow ring behind the dot
  ctx.beginPath();
  ctx.arc(DOT_X, DOT_Y, DOT_R + 3, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  // Solid dot
  ctx.beginPath();
  ctx.arc(DOT_X, DOT_Y, DOT_R, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  return canvas.toDataURL("image/png");
}

function setFaviconHref(href: string) {
  const el = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (el) el.href = href;
}

// How long (ms) to show the "just finished" blue dot after a game ends.
const FINISHED_DURATION_MS = 60_000;

export function useFaviconDot() {
  const queryClient = useQueryClient();
  const prevLiveRef = useRef(false);
  const finishedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function isCurrentlyLive(): boolean {
      const playerState = queryClient.getQueryData<SteamPlayerState>([
        "steam",
        "player-state",
      ]);
      if (playerState?.currentGame != null) return true;
      const lolQueries = queryClient.getQueriesData<LiveMatch | null>({
        queryKey: ["lol", "live"],
      });
      return lolQueries.some(([, data]) => data != null);
    }

    function update() {
      const live = isCurrentlyLive();

      if (live) {
        if (finishedTimerRef.current !== null) {
          clearTimeout(finishedTimerRef.current);
          finishedTimerRef.current = null;
        }
        if (!prevLiveRef.current) {
          void buildBadgedFavicon("#22c55e", "rgba(34,197,94,0.35)").then(setFaviconHref);
        }
        prevLiveRef.current = true;
        return;
      }

      if (prevLiveRef.current && finishedTimerRef.current === null) {
        void buildBadgedFavicon("#60a5fa", "rgba(96,165,250,0.35)").then(setFaviconHref);
        finishedTimerRef.current = setTimeout(() => {
          finishedTimerRef.current = null;
          setFaviconHref(FAVICON_DEFAULT);
        }, FINISHED_DURATION_MS);
      }

      prevLiveRef.current = false;
    }

    update();
    const unsubscribe = queryClient.getQueryCache().subscribe(update);

    return () => {
      unsubscribe();
      if (finishedTimerRef.current !== null) clearTimeout(finishedTimerRef.current);
      setFaviconHref(FAVICON_DEFAULT);
    };
  }, [queryClient]);
}
