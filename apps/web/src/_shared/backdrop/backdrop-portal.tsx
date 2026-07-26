import { useHydrated } from "@/lib/use-hydrated";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Shared shell classes for any backdrop layer rendered through BackdropPortal.
// Consumers apply this on the immediate child element (typically a `<m.div>`)
// so animation transforms and reduced-motion treatment stay per-section.
export const BACKDROP_SHELL_CLASS =
  "pointer-events-none fixed inset-0 -z-10 overflow-hidden";

export function BackdropPortal({ children }: { children: ReactNode }) {
  // `react-dom/server` cannot render a portal at all, so the backdrop is
  // structurally client-only. What matters is HOW it opts out: a
  // `typeof document` check makes the client's first render disagree with the
  // server's, and React responds by throwing away the whole server tree — this
  // component alone was doing that to every page that mounts a backdrop, which
  // is `/` and all of `/lol` and `/steam`. Deferring by one commit instead
  // costs the backdrop a single frame and keeps the rest of the document
  // hydrated rather than re-rendered.
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(children, document.body);
}
