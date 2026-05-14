import { useSeriousMatches } from "@/lol/_shared/serious-queues";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { RecapChampion } from "@/lol/recap/recap-champion";
import { RecapDuoOfYear } from "@/lol/recap/recap-duo-of-year";
import { RecapMostImproved } from "@/lol/recap/recap-most-improved";
import { RecapPatchVerdict } from "@/lol/recap/recap-patch-verdict";
import { RecapRankArc } from "@/lol/recap/recap-rank-arc";
import { RecapSignatureGame } from "@/lol/recap/recap-signature-game";
import { RecapTopInsight } from "@/lol/recap/recap-top-insight";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { m, useReducedMotion } from "motion/react";

export const Route = createFileRoute("/lol/$accountSlug/recap")({
  component: RecapPage,
});

function RecapPage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  // Recap is a performance artifact: champion-of-the-year and headline
  // insight only count serious play. Rank arc has its own data hook.
  const { matches } = useSeriousMatches();
  const reduced = useReducedMotion();
  const playedCount = matches?.filter((m) => !m.remake).length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-12">
      <Link
        to="/lol/$accountSlug"
        params={{ accountSlug }}
        search={(prev: Record<string, unknown>) => prev}
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Back to profile
      </Link>

      <m.header
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-col gap-2"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
          Recap
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Your year so far
        </h1>
        <p className="text-sm text-muted-foreground/80">
          A calm summary of what your last {playedCount} games look like.
        </p>
      </m.header>

      <RecapRankArc account={account} />
      <RecapChampion matches={matches} accountSlug={accountSlug} />
      <RecapMostImproved matches={matches} accountSlug={accountSlug} />
      <RecapSignatureGame matches={matches} accountSlug={accountSlug} />
      <RecapPatchVerdict matches={matches} />
      <RecapDuoOfYear accountSlug={accountSlug} />
      <RecapTopInsight matches={matches} />

      <m.p
        initial={reduced ? false : { opacity: 0 }}
        whileInView={reduced ? {} : { opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pt-4 text-center text-xs text-muted-foreground/50"
      >
        End of recap.
      </m.p>
    </div>
  );
}
