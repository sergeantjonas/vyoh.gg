import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Shared shell classes for any backdrop layer rendered through BackdropPortal.
// Consumers apply this on the immediate child element (typically a `<m.div>`)
// so animation transforms and reduced-motion treatment stay per-section.
export const BACKDROP_SHELL_CLASS =
  "pointer-events-none fixed inset-0 -z-10 overflow-hidden";

export function BackdropPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
