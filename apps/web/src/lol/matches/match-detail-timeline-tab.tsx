import { CvSection } from "@/_shared/cv-section";
import { MatchEventTimelines } from "@/lol/matches/match-event-timelines";
import type { MatchDetail } from "@vyoh/shared";
import { Suspense, lazy } from "react";
import { ChartFallback } from "./match-detail-shared";

// Recharts-backed chart loads behind a lazy boundary so the Recap tab
// (the default landing) doesn't pay the Recharts download + parse cost.
// Named-export wrapper because React.lazy expects a default export and
// we don't want to flip the public shape of the chart module just for this.
const MatchGoldLead = lazy(() =>
  import("@/lol/matches/match-gold-lead").then((m) => ({
    default: m.MatchGoldLead,
  }))
);

export function MatchTimelineTab({
  detail,
  myPuuid,
}: {
  detail: MatchDetail;
  myPuuid?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CvSection minHeight={320}>
        <Suspense fallback={<ChartFallback />}>
          <MatchGoldLead detail={detail} myPuuid={myPuuid} />
        </Suspense>
      </CvSection>
      <CvSection minHeight={400}>
        <MatchEventTimelines detail={detail} myPuuid={myPuuid} />
      </CvSection>
    </div>
  );
}
