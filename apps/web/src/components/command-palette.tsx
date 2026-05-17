import { useCommandPalette } from "@/components/command-palette-context";
import { Suspense, lazy, useEffect, useState } from "react";

const CommandPaletteDialog = lazy(() => import("./command-palette-dialog"));

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  if (!hasOpened) return null;

  return (
    <Suspense fallback={null}>
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
