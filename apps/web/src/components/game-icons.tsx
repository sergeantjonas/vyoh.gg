import {
  wikiAttackIconUrl,
  wikiGoldIconUrl,
  wikiMinionIconUrl,
  wikiWardIconUrl,
} from "@vyoh/shared";
import type { SVGProps } from "react";

export function GoldIcon({ className }: { className?: string }) {
  return (
    <img
      src={wikiGoldIconUrl()}
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
      src={wikiAttackIconUrl()}
      alt=""
      aria-hidden={true}
      className={className}
      draggable={false}
    />
  );
}

export function CsIcon({ className }: { className?: string }) {
  return (
    <img
      src={wikiMinionIconUrl()}
      alt=""
      aria-hidden={true}
      className={className}
      draggable={false}
    />
  );
}

export function VisionIcon({ className }: { className?: string }) {
  return (
    <img
      src={wikiWardIconUrl()}
      alt=""
      aria-hidden={true}
      className={className}
      draggable={false}
    />
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
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
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
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
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
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path d="m8.938 12.235-.47 1.883-.937-1.883-3.75-3.294-.937-1.882V5.647l.469-1.882.937.94 1.406-2.823L9.406 0v1.882l2.344.942 1.406 2.352v3.295L12.5 8l-1.219 1.412H9.406L8 8l.938-.47.468-.471v-.941l-.724-.942h-1.15l-.938 1.412V8l1.875 2.823zM6.381 13.177 7.531 16l-1.406-.941-1.406-.47L3.5 14.5l-1.349-.382L.5 12.235v-1.412l.938-.94h1.216l2.065 1.428zM9.406 16l1.094-2.823 1-1.866 2-1.429h1.063l.937.941v.942l-.937.94h-1.876l-.937.472-.36.434 1.297-.434h1.876L14 14l-.844.588h-1.875z" />
    </svg>
  );
}

// Tower — op.gg custom SVG
export function TowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="nonzero"
        d="m12 8-2 8H6L4 8l4 4zM8 0l4 4-1.003 1.002L11 5h3l-6 6-6-6h2.999L4 4zm0 2.4L6.4 4 8 5.6 9.6 4z"
      />
    </svg>
  );
}

// Baron Nashor — op.gg custom SVG
export function BaronNashorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="nonzero"
        d="M9 10a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0m0 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0m-2-2a1 1 0 1 1 2 0 1 1 0 0 1-2 0m5-10 2 4-1 1H9L8 4 7 5H5L4 4l2-4-6 4 2 4 3 8 1-1h4l1 1 3-8 2-4z"
      />
    </svg>
  );
}

// Fire Drake — op.gg custom SVG
export function FireDrakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.512 8.599 10.95 6.27l-3.597.986-.935 2.326 1.606 1.707 1.388-1.426-.925-.891.555-.777 1.579.12 1.01 1.456-3.53 3.572-3.115-3.526 1.12-3.43 3.2-1.332.654-2.087L7.373 0v3.103c-.432.427-2.79 2.718-4.356 4.238l-.703-1.264-.714 2.64 1.798 4.028L8.232 16l5.687-4.304.481-2.29v-1.71z"
      />
    </svg>
  );
}

// Cloud Drake — op.gg custom SVG
export function CloudDrakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m5.324 0 .78 3.85-1.146 3.236L2 9.94v3.12L4.97 16l-.582-2.376 1.065-3.346 3.25-2.895.568-2.64z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m10.91 2.61.485 2.689-.97 2.422-3.529 3.387-.812 1.265 1.945-.974 2.71-.394 2.557-2.413.017-3.326zM10.846 12.78l-2.549-.369-1.506 1.461 2.031.044 4.161 1.551 1.918-3.935V8.96z"
      />
    </svg>
  );
}

// Rift Herald — op.gg custom SVG
export function RiftHeraldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 17"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="nonzero"
        d="M14.286 11.387c1.219.552 1.714 1.599 1.714 1.599-1.155 2.232-2.581 2.351-2.755 2.357h-.018c.345-.39 1.059-3.956 1.059-3.956m-12.572 0s.713 3.565 1.058 3.956c0 0-1.541.023-2.772-2.357 0 0 .494-1.047 1.714-1.6M11.238 1s4.44 2.576 3.75 7.845c0 0-2.048.345-2.163 1.886 0 0-.85 3.382-4.762 3.52H7.93c-3.91-.138-4.762-3.52-4.762-3.52-.115-1.541-2.163-1.886-2.163-1.886C.314 3.576 4.754 1 4.754 1c-1.157 3.41.03 4.182.152 4.25l.01.006c1.09-.805 2.125-1.095 3.032-1.12q.024-.004.048-.002l.048-.002c.907.029 1.942.319 3.033 1.124 0 0 1.38-.667.16-4.256m-.127 7.638c.023-2.83-3.04-2.588-3.163-2.578-.123-.01-3.186-.252-3.163 2.578 0 0 .023 3.393 3.094 3.68h.138c3.07-.287 3.094-3.68 3.094-3.68M7.993 7.073c.571 0 1.034.94 1.034 2.102 0 1.16-.463 2.1-1.034 2.1-.57 0-1.034-.94-1.034-2.1s.463-2.102 1.034-2.102"
      />
    </svg>
  );
}

// Ocean Drake — op.gg custom SVG
export function OceanDrakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.2.333 5.386 1.425l-2.6 3.569-.256-2.416L.65 6.325l.643 6.039 5.603 3.303 3.642-1.962.817-4.098-.78-1.495L8.36 6.307 5.778 7.344l.61-1.242.991-.786.965-1.92 2.18-.616-1.311 2.255 2.492 2.125 1.137 2.182-.955 5.159 3.764-5.322-1.309-1.609.08-2.549z"
      />
    </svg>
  );
}

// Inhibitor — op.gg custom SVG
export function InhibitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12"
      />
      <path d="m8 4 4 4-4 4-4-4z" />
    </svg>
  );
}

// Elder Dragon — op.gg custom SVG
export function ElderDragonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.08 0 1.6 6.667v2.666l1.92 6L4.16 14v-3.333L5.44 12l1.92 4h1.28l1.92-4 1.28-1.333V14l.64 1.334 1.92-6V6.666L9.92 0 9.6 1.333v1.334l.96 2V6l-1.28.667v-2l-1.28-2-1.28 2v2L5.44 6V4.667l.96-2V1.333zm.64 9L7 10.334l-1.56-1L5 8zm2.56 0L9 10.334l1.56-1L11 8z"
      />
    </svg>
  );
}

// Mountain Drake — op.gg custom SVG
export function MountainDrakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 1.5px black)" }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.194 0 5.107 2.04l2.864 9.71 2.863-9.71L8.747 0zM1 6.052v4.966L5.857 16l1.233-1.22L3.731 3.383zM8.85 14.78 10.086 16l4.856-4.982V6.052l-2.73-2.669z"
      />
    </svg>
  );
}
