import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

// CDragon image icons — proxied through wsrv.nl

const MH =
  "raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default";
const UX = "raw.communitydragon.org/latest/game/assets/ux";

export function GoldIcon({ className }: { className?: string }) {
  return (
    <img
      src={`https://wsrv.nl/?url=${UX}/floatingtext/goldicon.png&w=24&output=webp`}
      alt=""
      aria-hidden={true}
      className={className}
      draggable={false}
    />
  );
}

export function KillsIcon({ className }: { className?: string }) {
  return (
    <img
      src={`https://wsrv.nl/?url=${MH}/kills.png&w=24&output=webp`}
      alt=""
      aria-hidden={true}
      className={className}
      draggable={false}
    />
  );
}

// icon_minions.png is a horizontal 2:1 sprite (two copies side by side).
// Wrap in an overflow-hidden square so only the left half (first icon) is visible.
export function CsIcon({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block overflow-hidden shrink-0", className)}>
      <img
        src={`https://wsrv.nl/?url=${MH}/icon_minions.png&output=webp`}
        alt=""
        aria-hidden={true}
        className="h-full w-auto max-w-none"
        draggable={false}
      />
    </span>
  );
}

// Game pictogram SVGs sourced from game-icons.net (CC BY 3.0).

// Crossed swords — Lorc (https://game-icons.net/1x1/lorc/crossed-swords.html)
export function CrossedSwordsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 512 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75.063-.062c21.827 21.93 44.04 43.923 66.405 66.25-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53 68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593-43.852-43.8-86.462-85.842-130.125-125.47-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562 56.81-56.812 13.22 13.187-56.438 56.44 24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53c-4.36 4.443-8.84 8.793-13.405 13.032L148.875 153.53l13.22-13.186zm-76.69 113.28l-28.5 28.532 68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717 28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313 17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594-15.068-18.587-28.38-38.758-39.5-60.625z" />
    </svg>
  );
}

// Void Grub — op.gg custom SVG
export function VoidGrubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M8 1 6.333 2.42s-.87.798-1.151.798H3.928c-.928 0-2.261.978-2.557 2.68-.074.429-.098 1.282.56 2.168L1 8.812s1.333.71 1.667 2.131C3 12.363 5.088 13.704 6.9 14.088l1.08.881V15L8 14.985l.019.015v-.031l1.08-.881c1.813-.384 3.901-1.724 4.234-3.145.334-1.42 1.667-2.13 1.667-2.13l-.931-.747c.658-.886.637-1.726.56-2.169-.296-1.701-1.629-2.68-2.557-2.68h-1.254c-.28 0-1.151-.797-1.151-.797zm.149 3.245a.2.2 0 0 0-.298 0L5.434 6.93a.2.2 0 0 0 .021.29c.275.228.818.687 1.007.914.21.255-1.316 1.405-1.862 1.804a.202.202 0 0 0-.026.304l1.84 1.88a.2.2 0 0 0 .285 0l1.158-1.183a.2.2 0 0 1 .286 0L9.3 12.122a.2.2 0 0 0 .286 0l1.84-1.88a.202.202 0 0 0-.026-.304c-.546-.399-2.073-1.549-1.862-1.804.189-.227.732-.686 1.007-.913a.2.2 0 0 0 .021-.29z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Hextech drake — op.gg custom SVG (diamond-cut crystal geometry)
export function HextechDrakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M8 1.283 9.06.222v2.121L14.718 8 8.53 14.187l-.53.53-.884.884v-1.767L1.282 8l6.364-6.364zM11.89 8 8 11.89 4.11 8l1.238-1.237L8 9.414l2.652-2.651zM9.534 5.646 8 4.111 6.465 5.646 8 7.181z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Chemtech drake — op.gg custom SVG (crystalline claw geometry)
export function ChemtechDrakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="m8.938 12.235-.47 1.883-.937-1.883-3.75-3.294-.937-1.882V5.647l.469-1.882.937.94 1.406-2.823L9.406 0v1.882l2.344.942 1.406 2.352v3.295L12.5 8l-1.219 1.412H9.406L8 8l.938-.47.468-.471v-.941l-.724-.942h-1.15l-.938 1.412V8l1.875 2.823zM6.381 13.177 7.531 16l-1.406-.941-1.406-.47L3.5 14.5l-1.349-.382L.5 12.235v-1.412l.938-.94h1.216l2.065 1.428zM9.406 16l1.094-2.823 1-1.866 2-1.429h1.063l.937.941v.942l-.937.94h-1.876l-.937.472-.36.434 1.297-.434h1.876L14 14l-.844.588h-1.875z" />
    </svg>
  );
}

// Two coins — Delapouite (https://game-icons.net/1x1/delapouite/two-coins.html)
export function TwoCoinsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 512 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M264.4 95.01c-35.6-.06-80.2 11.19-124.2 34.09C96.27 152 61.45 182 41.01 211.3c-20.45 29.2-25.98 56.4-15.92 75.8 10.07 19.3 35.53 30.4 71.22 30.4 35.69.1 80.29-11.2 124.19-34 44-22.9 78.8-53 99.2-82.2 20.5-29.2 25.9-56.4 15.9-75.8-10.1-19.3-35.5-30.49-71.2-30.49zm91.9 70.29c-3.5 15.3-11.1 31-21.8 46.3-22.6 32.3-59.5 63.8-105.7 87.8-46.2 24.1-93.1 36.2-132.5 36.2-18.6 0-35.84-2.8-50.37-8.7l10.59 20.4c10.08 19.4 35.47 30.5 71.18 30.5 35.7 0 80.3-11.2 124.2-34.1 44-22.8 78.8-52.9 99.2-82.2 20.4-29.2 26-56.4 15.9-75.7zm28.8 16.8c11.2 26.7 2.2 59.2-19.2 89.7-18.9 27.1-47.8 53.4-83.6 75.4 11.1 1.2 22.7 1.8 34.5 1.8 49.5 0 94.3-10.6 125.9-27.1 31.7-16.5 49.1-38.1 49.1-59.9 0-21.8-17.4-43.4-49.1-59.9-16.1-8.4-35.7-15.3-57.6-20zm106.7 124.8c-10.2 11.9-24.2 22.4-40.7 31-35 18.2-82.2 29.1-134.3 29.1-21.2 0-41.6-1.8-60.7-5.2-23.2 11.7-46.5 20.4-68.9 26.1 1.2.7 2.4 1.3 3.7 2 31.6 16.5 76.4 27.1 125.9 27.1s94.3-10.6 125.9-27.1c31.7-16.5 49.1-38.1 49.1-59.9z" />
    </svg>
  );
}
