import { OrbMark } from "@/home/orb-mark";

export function LandingHeading() {
  return (
    <header className="flex flex-col items-center gap-6 text-center">
      <OrbMark className="size-44 sm:size-56" />
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.7),0_0_8px_rgb(0_0_0_/_0.5)]">
        vyoh.gg
      </p>
      <h1 className="font-[720] text-[clamp(3.25rem,8.5vw,7rem)] leading-[0.98] -tracking-[0.03em]">
        <span className="block">A self-portrait,</span>
        <span className="block font-[360] text-muted-foreground/80 -tracking-[0.02em]">
          in League and Steam.
        </span>
      </h1>
    </header>
  );
}
