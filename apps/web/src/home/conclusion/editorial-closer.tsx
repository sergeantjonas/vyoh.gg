/**
 * Conclusion editorial closer. The page's pause — a single editorial line
 * framing the work. Static, no entrance beat, no scroll-coupled motion;
 * the surrounding bands carry whatever motion is needed for the conclusion.
 */
export function EditorialCloser() {
  return (
    <section className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="max-w-2xl text-balance text-base leading-relaxed text-foreground/85 md:text-lg">
        That's the picture. Built with React 19, NestJS, Postgres, and far too many Ahri
        games.
      </p>
      <p className="text-sm text-muted-foreground">— Vyoh</p>
    </section>
  );
}
