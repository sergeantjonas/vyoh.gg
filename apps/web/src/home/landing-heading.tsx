import { OrbMark } from "@/home/orb-mark";

export function LandingHeading() {
  return (
    <header className="flex flex-col items-center gap-4 text-center">
      <OrbMark className="size-40 sm:size-48" />
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
        vyoh.gg
      </p>
      <h1 className="font-[720] text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] -tracking-[0.02em]">
        <span className="block">A self-portrait,</span>
        <span className="block font-[380] text-muted-foreground/80">
          in League and Steam.
        </span>
      </h1>
    </header>
  );
}
