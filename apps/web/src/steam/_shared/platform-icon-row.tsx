import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Glasses } from "lucide-react";

// The Steam storefront's "Available on" row, scaled down. Each glyph is
// rendered for every platform the upstream resolved (windows / mac / linux
// / vr), with `false` greying the glyph out and `null` (no enrichment data)
// suppressing the glyph entirely — a quiet row is the correct signal for
// "we don't know" instead of "explicitly unsupported".
//
// Brand glyphs are inlined as SVG: Lucide intentionally ships only generic
// icons (Monitor / Apple-the-fruit) so a "Win/Mac/Linux" row reads as
// brand-agnostic UI unless we drop in the recognisable storefront marks.
// Pulling Simple Icons just for three glyphs would be overkill; the paths
// are well-known Simple Icons shapes (windows / apple / tux).
function WindowsGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function AppleGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function TuxGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.04 1.04 0 00-.061-.4c-.045-.134-.101-.2-.183-.333a.51.51 0 00-.39-.20.443.443 0 00-.105.02h-.004c-.04.013-.16.054-.193.067-.06.046-.114.137-.18.2-.165.207-.226.404-.226.65v.024c0 .043.001.052.005.072a.418.418 0 01-.005.131c.04.013.103.027.146.094.092.083.183.131.276.182.072.039.142.073.213.103-.16-.115-.244-.32-.244-.594 0-.243.072-.395.184-.522.114-.137.27-.213.426-.213z" />
    </svg>
  );
}

function PlatformBadge({
  label,
  supported,
  children,
}: {
  label: string;
  supported: boolean;
  children: React.ReactNode;
}) {
  // <button> rather than <span> so the trigger is keyboard-focusable and
  // touch users can long-press to see the label — `title=` would have
  // worked for desktop hover only, and violates the repo's
  // TooltipPrimitive-only convention.
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${supported ? "supported" : "not supported"}`}
          className={cn(
            "inline-flex size-6 cursor-help items-center justify-center rounded-md border focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            supported
              ? "border-foreground/20 bg-foreground/5 text-foreground/80"
              : "border-foreground/10 bg-transparent text-foreground/25"
          )}
        >
          {children}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          sideOffset={6}
          className="pointer-events-none z-50 rounded-md border bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
        >
          {label}: {supported ? "supported" : "not supported"}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function PlatformIconRow({
  windows,
  mac,
  linux,
  vr,
  className,
}: {
  windows: boolean | null;
  mac: boolean | null;
  linux: boolean | null;
  vr: boolean | null;
  className?: string;
}) {
  // Render a row only when at least one flag is known. All-null means the
  // enrichment row hasn't landed and we have nothing meaningful to say.
  if (windows === null && mac === null && linux === null && vr === null) {
    return null;
  }
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {windows !== null && (
        <PlatformBadge label="Windows" supported={windows}>
          <WindowsGlyph className="size-3.5" />
        </PlatformBadge>
      )}
      {mac !== null && (
        <PlatformBadge label="macOS" supported={mac}>
          <AppleGlyph className="size-3.5" />
        </PlatformBadge>
      )}
      {linux !== null && (
        <PlatformBadge label="Linux" supported={linux}>
          <TuxGlyph className="size-3.5" />
        </PlatformBadge>
      )}
      {vr === true && (
        <PlatformBadge label="VR supported" supported={true}>
          <Glasses className="size-3.5" />
        </PlatformBadge>
      )}
    </div>
  );
}
