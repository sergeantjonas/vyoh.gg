import { cn } from "@/lib/utils";
import { useState } from "react";

const loadedSrcs = new Set<string>();

export function ItemIcon({
  iconUrl,
  alt = "",
  className,
}: {
  iconUrl: string;
  alt?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(() => loadedSrcs.has(iconUrl));

  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden", className)}>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        src={iconUrl}
        alt={alt}
        loading="eager"
        onLoad={() => {
          loadedSrcs.add(iconUrl);
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
