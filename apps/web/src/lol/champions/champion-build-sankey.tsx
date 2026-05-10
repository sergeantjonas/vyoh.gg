import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useChampionBuildFlow } from "@/lol/champions/use-champion-build-flow";
import { useItems } from "@/lol/matches/use-items";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ParentSize } from "@visx/responsive";
import type { ChampionBuildFlowEntry } from "@vyoh/shared";
import {
  type SankeyLink,
  type SankeyNode,
  sankey,
  sankeyLinkHorizontal,
} from "d3-sankey";
import { useMemo } from "react";

const MIN_ENTRIES = 5;
const MAX_STEPS = 3;
const MAX_NODES_PER_STEP = 5;
const MIN_LINK_GAMES = 2;
const LIFT_THRESHOLD = 0.05;
const STEP_LABELS = ["Item 1", "Item 2", "Item 3"] as const;

const WIN_COLOR = "rgb(52, 211, 153)";
const LOSS_COLOR = "rgb(244, 63, 94)";
const NEUTRAL_COLOR = "rgb(161, 161, 170)";

const TOOLTIP_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

interface BuildNode {
  id: string;
  step: number;
  itemId: number;
  totalGames: number;
}

interface BuildLink {
  source: string;
  target: string;
  value: number;
  wins: number;
}

interface BuildGraph {
  nodes: BuildNode[];
  links: BuildLink[];
  baselineWR: number;
}

function buildGraph(entries: ChampionBuildFlowEntry[]): BuildGraph {
  // Per-step item totals for top-N filtering.
  const stepCounts = Array.from({ length: MAX_STEPS }, () => new Map<number, number>());
  for (const entry of entries) {
    const items = entry.items.slice(0, MAX_STEPS);
    for (let i = 0; i < items.length; i++) {
      const id = items[i];
      if (id === undefined) continue;
      const m = stepCounts[i];
      if (!m) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }
  const allowed = stepCounts.map((m) => {
    const list = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return new Set(list.slice(0, MAX_NODES_PER_STEP).map(([id]) => id));
  });

  const nodes = new Map<string, BuildNode>();
  const links = new Map<string, BuildLink>();
  for (const entry of entries) {
    const items = entry.items.slice(0, MAX_STEPS);
    // Filter each item to the per-step top-N set; truncate the entry at the
    // first item that falls out of the top set so paths stay coherent.
    const kept: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const id = items[i];
      if (id === undefined) break;
      const set = allowed[i];
      if (!set?.has(id)) break;
      kept.push(id);
    }

    for (let i = 0; i < kept.length; i++) {
      const id = kept[i];
      if (id === undefined) continue;
      const nodeId = `${i}:${id}`;
      const existing = nodes.get(nodeId);
      if (existing) {
        existing.totalGames += 1;
      } else {
        nodes.set(nodeId, { id: nodeId, step: i, itemId: id, totalGames: 1 });
      }
    }
    for (let i = 0; i < kept.length - 1; i++) {
      const fromId = `${i}:${kept[i]}`;
      const toId = `${i + 1}:${kept[i + 1]}`;
      const key = `${fromId}>${toId}`;
      const existing = links.get(key);
      if (existing) {
        existing.value += 1;
        if (entry.win) existing.wins += 1;
      } else {
        links.set(key, {
          source: fromId,
          target: toId,
          value: 1,
          wins: entry.win ? 1 : 0,
        });
      }
    }
  }

  const filteredLinks = [...links.values()].filter((l) => l.value >= MIN_LINK_GAMES);
  // Drop nodes that no longer have any filtered links touching them so the
  // Sankey doesn't render orphans floating in a column.
  const keptIds = new Set<string>();
  for (const l of filteredLinks) {
    keptIds.add(l.source);
    keptIds.add(l.target);
  }
  // Always keep step-0 nodes that show up in any kept entry, even if their
  // outgoing links got filtered — they still represent legitimate item-1
  // choices and the user can read the column from the icons alone.
  for (const n of nodes.values()) {
    if (n.step === 0) keptIds.add(n.id);
  }

  let totalGames = 0;
  let totalWins = 0;
  for (const e of entries) {
    if (e.items.length === 0) continue;
    totalGames += 1;
    if (e.win) totalWins += 1;
  }
  const baselineWR = totalGames > 0 ? totalWins / totalGames : 0.5;

  return {
    nodes: [...nodes.values()].filter((n) => keptIds.has(n.id)),
    links: filteredLinks,
    baselineWR,
  };
}

interface LaidOutNode extends SankeyNode<BuildNode, BuildLink> {
  step: number;
  itemId: number;
  totalGames: number;
}

interface LaidOutLink extends SankeyLink<BuildNode, BuildLink> {
  wins: number;
  value: number;
}

function colorForLift(linkWR: number, baselineWR: number): string {
  const lift = linkWR - baselineWR;
  if (lift > LIFT_THRESHOLD) return WIN_COLOR;
  if (lift < -LIFT_THRESHOLD) return LOSS_COLOR;
  return NEUTRAL_COLOR;
}

function SankeyDiagram({
  graph,
  iconForItem,
  nameForItem,
}: {
  graph: BuildGraph;
  iconForItem: (id: number) => string | undefined;
  nameForItem: (id: number) => string;
}) {
  return (
    <ParentSize>
      {({ width }) => {
        if (width < 200) return null;
        const height = 280;
        const margin = { top: 8, right: 12, bottom: 8, left: 12 };
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const layout = sankey<BuildNode, BuildLink>()
          .nodeId((d) => d.id)
          .nodeWidth(28)
          .nodePadding(10)
          .extent([
            [0, 0],
            [innerW, innerH],
          ]);

        // d3-sankey mutates the input; deep-clone first to avoid stale node
        // coordinates between renders.
        const result = layout({
          nodes: graph.nodes.map((n) => ({ ...n })),
          links: graph.links.map((l) => ({ ...l })),
        });

        const laidNodes = result.nodes as LaidOutNode[];
        const laidLinks = result.links as LaidOutLink[];
        const linkPath = sankeyLinkHorizontal<BuildNode, BuildLink>();

        return (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Build-order Sankey diagram"
          >
            <g transform={`translate(${margin.left} ${margin.top})`}>
              {/* Links */}
              {laidLinks.map((link) => {
                const wr = link.value === 0 ? 0.5 : link.wins / link.value;
                const color = colorForLift(wr, graph.baselineWR);
                const d = linkPath(link) ?? "";
                const sourceNode = link.source as LaidOutNode;
                const targetNode = link.target as LaidOutNode;
                const linkKey = `${sourceNode.id}>${targetNode.id}`;
                return (
                  <TooltipPrimitive.Root key={linkKey} delayDuration={80}>
                    <TooltipPrimitive.Trigger asChild>
                      <path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeOpacity={0.35}
                        strokeWidth={Math.max(1, link.width ?? 1)}
                      />
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content
                        side="top"
                        sideOffset={6}
                        className={TOOLTIP_CLASS}
                      >
                        <span className="font-semibold">
                          {nameForItem(sourceNode.itemId)}
                        </span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-semibold">
                          {nameForItem(targetNode.itemId)}
                        </span>
                        <div className="mt-0.5 text-muted-foreground">
                          {link.value} {link.value === 1 ? "game" : "games"} ·{" "}
                          {Math.round(wr * 100)}% WR
                        </div>
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                );
              })}

              {/* Nodes */}
              {laidNodes.map((node) => {
                const x0 = node.x0 ?? 0;
                const y0 = node.y0 ?? 0;
                const x1 = node.x1 ?? x0;
                const y1 = node.y1 ?? y0;
                const w = x1 - x0;
                const h = y1 - y0;
                const icon = iconForItem(node.itemId);
                return (
                  <TooltipPrimitive.Root key={node.id} delayDuration={80}>
                    <TooltipPrimitive.Trigger asChild>
                      <g style={{ cursor: "default" }}>
                        <rect
                          x={x0}
                          y={y0}
                          width={w}
                          height={h}
                          rx={3}
                          fill="rgba(245, 245, 245, 0.04)"
                          stroke="rgba(245, 245, 245, 0.16)"
                          strokeWidth={0.5}
                        />
                        {icon ? (
                          <image
                            href={icon}
                            x={x0 + 2}
                            y={y0 + Math.max(2, (h - w + 4) / 2)}
                            width={w - 4}
                            height={Math.min(h - 4, w - 4)}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        ) : null}
                      </g>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content
                        side="top"
                        sideOffset={6}
                        className={TOOLTIP_CLASS}
                      >
                        <span className="font-semibold">{nameForItem(node.itemId)}</span>
                        <div className="mt-0.5 text-muted-foreground">
                          Step {node.step + 1} · {node.totalGames}{" "}
                          {node.totalGames === 1 ? "game" : "games"}
                        </div>
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                );
              })}
            </g>
          </svg>
        );
      }}
    </ParentSize>
  );
}

function StepLabelsRow() {
  return (
    <div className="grid grid-cols-3 px-3 text-[10px] uppercase tracking-wide text-muted-foreground/60">
      {STEP_LABELS.map((label) => (
        <span key={label} className="text-center">
          {label}
        </span>
      ))}
    </div>
  );
}

export function ChampionBuildSankey({
  accountSlug,
  championKey,
}: {
  accountSlug: string;
  championKey: string;
}) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useChampionBuildFlow(account, championKey);
  const itemsData = useItems();

  const graph = useMemo(() => (data ? buildGraph(data) : null), [data]);

  if (isPending || !data) return null;

  if (!graph || graph.nodes.length === 0 || data.length < MIN_ENTRIES) {
    return (
      <ConclusionCard
        title="Build path"
        sampleSize={data.length}
        verdict={`Need ${MIN_ENTRIES}+ matches with timeline data to map your build flow on this champion.`}
        empty
      />
    );
  }

  // Find the heaviest path (greedy from the most-popular step-1 node).
  const step1Nodes = graph.nodes
    .filter((n) => n.step === 0)
    .sort((a, b) => b.totalGames - a.totalGames);
  const top = step1Nodes[0];
  let verdict: string;
  if (top) {
    const path: string[] = [];
    let current: BuildNode | undefined = top;
    while (current) {
      const name = itemsData.data?.get(current.itemId)?.name ?? `Item ${current.itemId}`;
      path.push(name);
      const next = graph.links
        .filter((l) => l.source === current?.id)
        .sort((a, b) => b.value - a.value)[0];
      if (!next) break;
      current = graph.nodes.find((n) => n.id === next.target);
    }
    const totalGamesAlongTop = top.totalGames;
    verdict = `Most-built path on ${path.length} ${
      path.length === 1 ? "item" : "items"
    }: ${path.join(" → ")} (${totalGamesAlongTop} ${totalGamesAlongTop === 1 ? "game" : "games"}).`;
  } else {
    verdict = "Build paths are too varied to highlight a dominant one.";
  }

  return (
    <ConclusionCard
      title="Build path"
      sampleSize={data.length}
      verdict={verdict}
      verdictMarkdown={verdict}
      evidence={
        <div className="flex flex-col gap-1.5">
          <StepLabelsRow />
          <SankeyDiagram
            graph={graph}
            iconForItem={(id) => itemsData.data?.get(id)?.iconUrl}
            nameForItem={(id) => itemsData.data?.get(id)?.name ?? `Item ${id}`}
          />
        </div>
      }
    />
  );
}
