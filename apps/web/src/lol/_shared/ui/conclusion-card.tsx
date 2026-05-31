import { CardShell, type CardShellProps } from "@/components/card-shell";
import { SampleSizeBadge } from "./sample-size-badge";

export interface ConclusionCardProps extends Omit<CardShellProps, "indicator"> {
  sampleSize: number;
  // Accepted for caller-side documentation parity (trend cards typically
  // co-locate a markdown copy alongside the rendered string), but unused by
  // the renderer — kept off CardShell since it's LoL-trend-specific.
  verdictMarkdown?: string;
  prescriptionMarkdown?: string | undefined;
}

// LoL-trends cards make confidence-weighted claims — N games is a statistical
// sample, not a catalog count. The SampleSizeBadge tooltip reflects that with
// "Small sample / Moderate / Confident estimate" language. For catalog facts
// (Steam library size, wishlist length), use FactCard instead so the indicator
// stays semantically honest.
export function ConclusionCard({
  sampleSize,
  verdictMarkdown: _verdictMarkdown,
  prescriptionMarkdown: _prescriptionMarkdown,
  ...rest
}: ConclusionCardProps) {
  return <CardShell {...rest} indicator={<SampleSizeBadge count={sampleSize} />} />;
}
