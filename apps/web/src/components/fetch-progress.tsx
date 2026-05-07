import { useIsFetching } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";

export function FetchProgress() {
  const isFetching = useIsFetching();

  return (
    <AnimatePresence>
      {isFetching > 0 && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
          aria-hidden="true"
        >
          <m.div
            animate={{ x: ["-100%", "300%"] }}
            transition={{
              duration: 1.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-sky-400 to-transparent"
            style={{ boxShadow: "0 0 6px rgba(56,189,248,0.5)" }}
          />
        </m.div>
      )}
    </AnimatePresence>
  );
}
