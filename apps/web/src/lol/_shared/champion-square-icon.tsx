import { cn } from "@/lib/utils";
import { championSquareIconUrl } from "@/lol/_shared/champion-icon";
import { useState } from "react";

const loadedSrcs = new Set<string>();

export function ChampionSquareIcon({
  championName,
  alt = "",
  className,
}: {
  championName: string;
  alt?: string;
  className?: string;
}) {
  const url = championSquareIconUrl(championName);
  const [loaded, setLoaded] = useState(() => loadedSrcs.has(url));

  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden", className)}>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        src={url}
        alt={alt}
        loading="eager"
        onLoad={() => {
          loadedSrcs.add(url);
          setLoaded(true);
        }}
        className={cn(
          "size-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </span>
  );
}
