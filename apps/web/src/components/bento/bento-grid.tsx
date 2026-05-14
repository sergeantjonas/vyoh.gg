import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type TileWidth = 1 | 2;
export type TileHeight = 1 | 2;

const COL_SPAN: Record<TileWidth, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
};
const ROW_SPAN: Record<TileHeight, string> = {
  1: "sm:row-span-1",
  2: "sm:row-span-2",
};

export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-[minmax(11rem,auto)] lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoTile({
  width = 1,
  height = 1,
  children,
  className,
}: {
  width?: TileWidth;
  height?: TileHeight;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0", COL_SPAN[width], ROW_SPAN[height], className)}>
      {children}
    </div>
  );
}
