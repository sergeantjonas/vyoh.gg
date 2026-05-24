import { cn } from "@/lib/utils";
import { Apple, Glasses, Monitor } from "lucide-react";

// The Steam storefront's "Available on" row, scaled down. Each glyph is
// rendered for every platform the upstream resolved (windows / mac / linux
// / vr), with `false` greying the glyph out and `null` (no enrichment data)
// suppressing the glyph entirely — a quiet row is the correct signal for
// "we don't know" instead of "explicitly unsupported".
//
// Tux (Linux) has no shipped Lucide glyph; the only stock options were
// generic monitors. Render an inline svg of the classic Tux outline so the
// row reads as Win/Mac/Linux at a glance without pulling in a second icon
// library.
function TuxGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2c-2.2 0-3.5 1.7-3.5 4 0 1.1.4 2.2.9 3-.7.7-1.4 1.6-1.9 2.6-.7 1.5-1.5 3.2-2 4.3-.5 1-.5 2.4.5 3 .8.5 1.6 0 2.3-.5.3-.2.6-.5.9-.7.3.7.7 1.4 1.1 2 .5.7 1.4 1.3 2.7 1.3s2.2-.6 2.7-1.3c.4-.6.8-1.3 1.1-2 .3.2.6.5.9.7.7.5 1.5 1 2.3.5 1-.6 1-2 .5-3-.5-1.1-1.3-2.8-2-4.3-.5-1-1.2-1.9-1.9-2.6.5-.8.9-1.9.9-3 0-2.3-1.3-4-3.5-4zM10.5 6c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zm3 0c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z" />
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
  return (
    <span
      title={label}
      aria-label={`${label}: ${supported ? "supported" : "not supported"}`}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md border",
        supported
          ? "border-foreground/20 bg-foreground/5 text-foreground/80"
          : "border-foreground/10 bg-transparent text-foreground/25"
      )}
    >
      {children}
    </span>
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
          <Monitor className="size-3.5" />
        </PlatformBadge>
      )}
      {mac !== null && (
        <PlatformBadge label="macOS" supported={mac}>
          <Apple className="size-3.5" />
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
