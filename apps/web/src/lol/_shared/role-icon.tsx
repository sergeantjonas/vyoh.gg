import { cn } from "@/lib/utils";
import { useState } from "react";

export type RolePosition = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

export const ROLE_ORDER: RolePosition[] = [
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
];

export const ROLE_LABEL: Record<RolePosition, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};

export function isRolePosition(value: string): value is RolePosition {
  return (
    value === "TOP" ||
    value === "JUNGLE" ||
    value === "MIDDLE" ||
    value === "BOTTOM" ||
    value === "UTILITY"
  );
}

import { getRoleIconAsset } from "@/lol/_shared/asset-manifest";

const CDRAGON_POSITION_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg";

const POSITION_SLUG: Record<RolePosition, string> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "middle",
  BOTTOM: "bottom",
  UTILITY: "utility",
};

export function roleIconUrl(position: RolePosition): string {
  const slug = POSITION_SLUG[position];
  return getRoleIconAsset(slug) ?? `${CDRAGON_POSITION_BASE}/position-${slug}.svg`;
}

interface RoleIconProps {
  position: RolePosition;
  className?: string;
  title?: string;
}

// Hand-rolled fallback used only when the CDragon SVG fails to load.
// Minimap-quadrant abstractions: TOP/BOT mirror diagonally; JUNGLE is a
// cluster; MIDDLE the central diagonal; UTILITY a warding cross.
function RoleIconFallback({ position, className, title }: RoleIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("inline-block shrink-0", className)}
      role="img"
      aria-label={title ?? ROLE_LABEL[position]}
    >
      <title>{title ?? ROLE_LABEL[position]}</title>
      {position === "TOP" && (
        <>
          <path d="M2.5 2.5h6" />
          <path d="M2.5 2.5v6" />
          <path d="M13.5 13.5l-9-9" strokeOpacity="0.45" />
        </>
      )}
      {position === "JUNGLE" && (
        <>
          <circle cx="5.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
          <circle
            cx="7.5"
            cy="10"
            r="1.2"
            fill="currentColor"
            stroke="none"
            opacity="0.7"
          />
          <circle
            cx="11"
            cy="10.5"
            r="1.2"
            fill="currentColor"
            stroke="none"
            opacity="0.5"
          />
        </>
      )}
      {position === "MIDDLE" && (
        <>
          <path d="M2.5 13.5l11-11" />
          <path d="M3 8.5l4.5-4.5" strokeOpacity="0.45" />
          <path d="M8.5 12.5L13 8" strokeOpacity="0.45" />
        </>
      )}
      {position === "BOTTOM" && (
        <>
          <path d="M13.5 13.5h-6" />
          <path d="M13.5 13.5v-6" />
          <path d="M2.5 2.5l9 9" strokeOpacity="0.45" />
        </>
      )}
      {position === "UTILITY" && (
        <>
          <path d="M8 3v10" />
          <path d="M3 8h10" />
          <circle cx="8" cy="8" r="3.5" strokeOpacity="0.45" />
        </>
      )}
    </svg>
  );
}

export function RoleIcon({ position, className, title }: RoleIconProps) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return <RoleIconFallback position={position} className={className} title={title} />;
  }
  return (
    <img
      src={roleIconUrl(position)}
      alt={title ?? ROLE_LABEL[position]}
      onError={() => setErrored(true)}
      className={cn("inline-block shrink-0 select-none", className)}
      draggable={false}
    />
  );
}
