import { mainScrollRef } from "@/lib/scroll-container";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";

const SHOW_THRESHOLD_PX = 500;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container) return;
    const onScroll = () => setVisible(container.scrollTop > SHOW_THRESHOLD_PX);
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <m.button
          type="button"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={() => mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card/80 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-muted"
        >
          <ArrowUp className="size-5" />
        </m.button>
      )}
    </AnimatePresence>
  );
}
