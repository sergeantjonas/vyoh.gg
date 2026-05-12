import { Suspense, lazy, useEffect, useState } from "react";

const CommandPaletteDialog = lazy(() => import("./command-palette-dialog"));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        setHasOpened(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!hasOpened) return null;

  return (
    <Suspense fallback={null}>
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
