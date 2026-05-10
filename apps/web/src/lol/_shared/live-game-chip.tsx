import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useLiveGame } from "@/lol/matches/use-live-match";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, m } from "motion/react";

// SSE subscription lives at the $accountSlug layout level; the chip just
// renders the cached query result.
export function LiveGameChip({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data } = useLiveGame(account);

  return (
    <AnimatePresence>
      {data && (
        <m.div
          key="live-chip"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <Link
            to="/lol/$accountSlug/live"
            params={{ accountSlug }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-500/30 transition-colors hover:bg-red-500/25"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            In Game
          </Link>
        </m.div>
      )}
    </AnimatePresence>
  );
}
