import { type ReactNode, useEffect, useRef, useState } from "react";

type Props = {
  children: ReactNode;
  // Skip the IntersectionObserver wait and mount immediately. Use for
  // tiles known to be above the fold so the user doesn't see a
  // single-frame placeholder flash on first paint.
  eager?: boolean;
  // Placeholder height before the child mounts. Should approximate the
  // real tile's height so the grid layout doesn't collapse — once the
  // child mounts, its own intrinsic size takes over.
  minHeight?: number;
  // IO trigger margin — start mounting `rootMargin` ahead of the
  // viewport edge so the child is ready by the time it actually scrolls
  // in. Default 200px is roughly one screen-height worth of lead.
  rootMargin?: string;
  // Forwarded to the placeholder + the mounted wrapper. Lets the parent
  // grid keep its `md:col-span-*` rule in both states without juggling
  // structure.
  className?: string;
};

// Defer the React render of `children` until the wrapper is intersected
// by the viewport (or eagerly, when `eager` is set). Once mounted, the
// child STAYS mounted — scrolling out doesn't unmount it, so the user
// doesn't pay the re-render cost on every scroll-back. Heavy tiles
// (Recharts surfaces, dense heatmaps) opt into this so the
// initial-mount cost of the trends grid is paid in slices instead of
// one cliff.
export function DeferredMount({
  children,
  eager,
  minHeight = 200,
  rootMargin = "200px",
  className,
}: Props) {
  const [mounted, setMounted] = useState(eager ?? false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, rootMargin]);

  if (mounted) return <div className={className}>{children}</div>;
  return <div ref={ref} className={className} style={{ minHeight }} />;
}
