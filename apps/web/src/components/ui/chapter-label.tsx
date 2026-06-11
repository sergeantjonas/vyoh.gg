import type * as React from "react";

import { cn } from "@/lib/utils";

type ChapterLabelElement = "h2" | "h3" | "h4";

/**
 * Third header recipe next to SectionTitle/CardTitle: the quiet chapter/eyebrow
 * label that opens an editorial band (recap chapters, achievement tiles).
 * Exported separately for motion elements (m.h2) that can't swap the component.
 */
const CHAPTER_LABEL_CLASS = "text-xs uppercase tracking-wide text-muted-foreground/70";

function ChapterLabel({
  as: Component = "h2",
  className,
  ...props
}: React.ComponentProps<"h2"> & { as?: ChapterLabelElement }) {
  return (
    <Component
      data-slot="chapter-label"
      className={cn(CHAPTER_LABEL_CLASS, className)}
      {...props}
    />
  );
}

export { CHAPTER_LABEL_CLASS, ChapterLabel };
