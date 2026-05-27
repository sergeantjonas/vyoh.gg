import { cn } from "@/lib/utils";
import {
  type CSSProperties,
  Children,
  type ReactNode,
  cloneElement,
  isValidElement,
} from "react";

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
  // Walk top-level children once and stamp each with its ordinal via inline
  // `--i`, consumed by the .stagger-children rule in motion.css. Non-element
  // children (strings, fragments) pass through untouched.
  let index = 0;
  const staggered = Children.map(children, (child) => {
    if (!isValidElement<{ style?: CSSProperties }>(child)) return child;
    const i = index++;
    const merged: CSSProperties = { ...(child.props.style ?? {}), ["--i" as string]: i };
    return cloneElement(child, { style: merged });
  });

  return (
    <div
      className={cn(
        "stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-[minmax(11rem,auto)] lg:grid-cols-4",
        className
      )}
    >
      {staggered}
    </div>
  );
}

export function BentoTile({
  width = 1,
  height = 1,
  children,
  className,
  style,
}: {
  width?: TileWidth;
  height?: TileHeight;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("view-entry min-h-0", COL_SPAN[width], ROW_SPAN[height], className)}
      style={style}
    >
      {children}
    </div>
  );
}
